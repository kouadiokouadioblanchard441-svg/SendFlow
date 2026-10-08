import { and, customerAuthAttemptsTable, db, desc, inArray, lt, sql } from "@workspace/db";
import {
  CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
  GENERAL_AUTH_RATE_LIMIT_POLICY,
  getAuthFailureWindowStart,
  getAuthLockoutExpiry,
  type AuthRateLimitPolicy,
} from "./customer-auth-rate-limit-policy";
import { fingerprint } from "./request-security";
import {
  getCustomerAccessAttemptBuckets as createCustomerAccessAttemptBuckets,
  getCustomerAccessAttemptBucketsForRequest as createCustomerAccessAttemptBucketsForRequest,
  getCustomerAccessPhoneAttemptBucket as createCustomerAccessPhoneAttemptBucket,
} from "./customer-auth-rate-limit-buckets";

export {
  CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
  GENERAL_AUTH_RATE_LIMIT_POLICY,
  formatAuthRateLimitMessage,
} from "./customer-auth-rate-limit-policy";
export type { AuthRateLimitPolicy } from "./customer-auth-rate-limit-policy";
const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export type AuthRateLimitDatabase = Pick<typeof db, "select" | "insert" | "delete" | "update">;

export function getCustomerAccessPhoneAttemptBucket(phoneHash: string) {
  return createCustomerAccessPhoneAttemptBucket(phoneHash, fingerprint);
}

export function getCustomerAccessAttemptBuckets(phoneHash: string | null, requesterHash: string) {
  return createCustomerAccessAttemptBuckets(phoneHash, requesterHash, fingerprint);
}

export function getCustomerAccessAttemptBucketsForRequest(phone: string | null, requesterAddress: string) {
  return createCustomerAccessAttemptBucketsForRequest(phone, requesterAddress, fingerprint);
}

export async function withAuthAttemptLock<T>(
  buckets: string[],
  action: (database: AuthRateLimitDatabase) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Lock both the account and requester buckets in a consistent order, across API instances.
    for (const bucket of [...new Set(buckets)].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${bucket}, 0))`);
    }
    return action(tx);
  });
}

// Existing PIN-specific call sites share the same cross-instance lock primitive.
export const withPinAttemptLock = withAuthAttemptLock;

export function retryAfterSeconds(until: Date, now = new Date()) {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

export async function getAuthRateLimit(
  buckets: string[],
  now = new Date(),
  database: AuthRateLimitDatabase = db,
) {
  if (!buckets.length) return null;
  const [row] = await database
    .select({ blockedUntil: customerAuthAttemptsTable.blockedUntil })
    .from(customerAuthAttemptsTable)
    .where(
      and(
        inArray(customerAuthAttemptsTable.bucketHash, buckets),
        sql`${customerAuthAttemptsTable.blockedUntil} > ${now}`,
      ),
    )
    .orderBy(desc(customerAuthAttemptsTable.blockedUntil))
    .limit(1);

  return row?.blockedUntil ? retryAfterSeconds(row.blockedUntil, now) : null;
}

export async function recordAuthFailure(
  buckets: string[],
  now = new Date(),
  database?: AuthRateLimitDatabase,
  policy: AuthRateLimitPolicy = GENERAL_AUTH_RATE_LIMIT_POLICY,
) {
  const windowStart = getAuthFailureWindowStart(now, policy);
  const blockedUntil = getAuthLockoutExpiry(now, policy);
  const retentionCutoff = new Date(now.getTime() - ATTEMPT_RETENTION_MS);

  const record = async (tx: AuthRateLimitDatabase) => {
    await tx
      .delete(customerAuthAttemptsTable)
      .where(lt(customerAuthAttemptsTable.updatedAt, retentionCutoff));

    for (const bucketHash of buckets) {
      await tx
        .insert(customerAuthAttemptsTable)
        .values({
          bucketHash,
          failureCount: 1,
          windowStartedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: customerAuthAttemptsTable.bucketHash,
          set: {
            failureCount: sql`case
              when ${customerAuthAttemptsTable.windowStartedAt} < ${windowStart} then 1
              else least(${customerAuthAttemptsTable.failureCount} + 1, 20)
            end`,
            windowStartedAt: sql`case
              when ${customerAuthAttemptsTable.windowStartedAt} < ${windowStart} then ${now}
              else ${customerAuthAttemptsTable.windowStartedAt}
            end`,
            blockedUntil: sql`case
              when ${customerAuthAttemptsTable.windowStartedAt} < ${windowStart} then null
              when ${customerAuthAttemptsTable.failureCount} + 1 >= ${policy.maxFailures} then ${blockedUntil}
              else ${customerAuthAttemptsTable.blockedUntil}
            end`,
            updatedAt: now,
          },
        });
    }
  };
  if (database) await record(database);
  else await db.transaction(record);
}

export async function recordAuthFailureAndGetRetryAfter(
  buckets: string[],
  now: Date,
  policy: AuthRateLimitPolicy,
  database?: AuthRateLimitDatabase,
) {
  const recordAndCheck = async (tx: AuthRateLimitDatabase) => {
    const existingRetry = await getAuthRateLimit(buckets, now, tx);
    if (existingRetry !== null) return existingRetry;

    await recordAuthFailure(buckets, now, tx, policy);
    return getAuthRateLimit(buckets, now, tx);
  };

  if (database) return recordAndCheck(database);
  return withAuthAttemptLock(buckets, recordAndCheck);
}

export async function clearAuthFailures(buckets: string[], database: AuthRateLimitDatabase = db) {
  if (!buckets.length) return;
  await database
    .delete(customerAuthAttemptsTable)
    .where(inArray(customerAuthAttemptsTable.bucketHash, buckets));
}