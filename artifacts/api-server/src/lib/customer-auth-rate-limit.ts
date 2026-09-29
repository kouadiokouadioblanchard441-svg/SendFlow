import { and, customerAuthAttemptsTable, db, inArray, lt, sql } from "@workspace/db";

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
type RateLimitDatabase = Pick<typeof db, "select" | "insert" | "delete" | "update">;

export async function withPinAttemptLock<T>(
  buckets: string[],
  action: (database: RateLimitDatabase) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Lock both the account and requester buckets in a consistent order, across API instances.
    for (const bucket of [...new Set(buckets)].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${bucket}, 0))`);
    }
    return action(tx);
  });
}

export function retryAfterSeconds(until: Date, now = new Date()) {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

export async function getAuthRateLimit(
  buckets: string[],
  now = new Date(),
  database: RateLimitDatabase = db,
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
    .orderBy(customerAuthAttemptsTable.blockedUntil)
    .limit(1);

  return row?.blockedUntil ? retryAfterSeconds(row.blockedUntil, now) : null;
}

export async function recordAuthFailure(
  buckets: string[],
  now = new Date(),
  database?: RateLimitDatabase,
) {
  const windowStart = new Date(now.getTime() - FAILURE_WINDOW_MS);
  const blockedUntil = new Date(now.getTime() + FAILURE_WINDOW_MS);
  const retentionCutoff = new Date(now.getTime() - ATTEMPT_RETENTION_MS);

  const record = async (tx: RateLimitDatabase) => {
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
              when ${customerAuthAttemptsTable.failureCount} + 1 >= ${MAX_FAILURES} then ${blockedUntil}
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

export async function clearAuthFailures(buckets: string[], database: RateLimitDatabase = db) {
  if (!buckets.length) return;
  await database
    .delete(customerAuthAttemptsTable)
    .where(inArray(customerAuthAttemptsTable.bucketHash, buckets));
}