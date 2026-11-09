import {
  and,
  db,
  eq,
  gte,
  inArray,
  lt,
  payoutRequestsTable,
  sql,
  transactionsTable,
  customerIdentityRequestsTable,
} from "@workspace/db";
import { getRemainingMonthlyAccountLimit, getUtcMonthRange } from "./account-limit-policy";
import { getMonthlyIncomingPolicy } from "../data/unverified-incoming-policy";

type MonthlyOutgoingReader = Pick<typeof db, "select">;
const outgoingTransferKinds = ["inter-network", "international"] as const;

export async function getMonthlyOutgoingUsage(
  userId: string,
  now = new Date(),
  reader: MonthlyOutgoingReader = db,
) {
  if (!userId) throw new Error("Authenticated user is required");
  const { periodStart, periodEnd } = getUtcMonthRange(now);
  const [successfulTransfers, pendingTransfers, successfulPayouts, pendingPayouts] = await Promise.all([
    reader.select({
      total: sql<unknown>`coalesce(sum(${transactionsTable.amountMinor}), 0)`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.userId, userId),
      eq(transactionsTable.currency, "XOF"),
      inArray(transactionsTable.kind, outgoingTransferKinds),
      eq(transactionsTable.status, "succeeded"),
      gte(transactionsTable.createdAt, periodStart),
      lt(transactionsTable.createdAt, periodEnd),
    )),
    reader.select({
      total: sql<unknown>`coalesce(sum(${transactionsTable.amountMinor}), 0)`,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.userId, userId),
      eq(transactionsTable.currency, "XOF"),
      inArray(transactionsTable.kind, outgoingTransferKinds),
      eq(transactionsTable.status, "pending"),
      gte(transactionsTable.createdAt, periodStart),
      lt(transactionsTable.createdAt, periodEnd),
    )),
    reader.select({
      total: sql<unknown>`coalesce(sum(${payoutRequestsTable.amountMinor}), 0)`,
    }).from(payoutRequestsTable).where(and(
      eq(payoutRequestsTable.merchantUserId, userId),
      eq(payoutRequestsTable.currency, "XOF"),
      eq(payoutRequestsTable.status, "succeeded"),
      gte(payoutRequestsTable.createdAt, periodStart),
      lt(payoutRequestsTable.createdAt, periodEnd),
    )),
    reader.select({
      total: sql<unknown>`coalesce(sum(${payoutRequestsTable.amountMinor}), 0)`,
    }).from(payoutRequestsTable).where(and(
      eq(payoutRequestsTable.merchantUserId, userId),
      eq(payoutRequestsTable.currency, "XOF"),
      eq(payoutRequestsTable.reservationState, "active"),
      gte(payoutRequestsTable.createdAt, periodStart),
      lt(payoutRequestsTable.createdAt, periodEnd),
    )),
  ]);
  const sentAmount = Number(successfulTransfers[0]?.total ?? 0)
    + Number(successfulPayouts[0]?.total ?? 0);
  const pendingAmount = Number(pendingTransfers[0]?.total ?? 0)
    + Number(pendingPayouts[0]?.total ?? 0);
  if (!Number.isSafeInteger(sentAmount) || sentAmount < 0
    || !Number.isSafeInteger(pendingAmount) || pendingAmount < 0
    || !Number.isSafeInteger(sentAmount + pendingAmount)) {
    throw new Error("Monthly outgoing usage is outside the safe integer range");
  }
  return { sentAmount, pendingAmount };
}

export async function getAccountLimitSnapshot(userId: string, now = new Date()) {
  const [latestVerification, monthlyIncomingPolicy, monthlyOutgoingUsage] = await Promise.all([
    db.select({ status: customerIdentityRequestsTable.status })
      .from(customerIdentityRequestsTable)
      .where(eq(customerIdentityRequestsTable.userId, userId))
      .orderBy(sql`${customerIdentityRequestsTable.submittedAt} desc`)
      .limit(1),
    getMonthlyIncomingPolicy(userId, now),
    getMonthlyOutgoingUsage(userId, now),
  ]);
  const [latest] = latestVerification;
  const status = latest?.status === "approved"
    ? "verified" as const
    : latest?.status === "pending"
      ? "pending" as const
      : latest?.status === "rejected"
        ? "failed" as const
        : "unverified" as const;
  const monthlyLimit = monthlyIncomingPolicy.effectiveLimitMinor;
  const { periodStart, periodEnd } = getUtcMonthRange(now);

  return {
    status,
    currency: "XOF" as const,
    monthlyLimit,
    sentAmount: monthlyOutgoingUsage.sentAmount,
    pendingAmount: monthlyOutgoingUsage.pendingAmount,
    remainingAmount: getRemainingMonthlyAccountLimit(
      monthlyLimit,
      monthlyOutgoingUsage.sentAmount,
      monthlyOutgoingUsage.pendingAmount,
    ),
    periodStart,
    periodEnd,
  };
}
