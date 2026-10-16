import {
  and,
  db,
  desc,
  eq,
  gte,
  identityVerificationsTable,
  inArray,
  lt,
  sql,
  transactionsTable,
} from "@workspace/db";
import {
  getMonthlyAccountLimit,
  getUtcMonthRange,
  mapDiditStatusToAccountLimitStatus,
} from "./account-limit-policy";

export async function getAccountLimitSnapshot(userId: string, now = new Date()) {
  const [approvedVerification] = await db
    .select({ status: identityVerificationsTable.status })
    .from(identityVerificationsTable)
    .where(
      and(
        eq(identityVerificationsTable.userId, userId),
        eq(identityVerificationsTable.status, "Approved"),
      ),
    )
    .orderBy(desc(identityVerificationsTable.createdAt))
    .limit(1);

  const [latestVerification] = approvedVerification
    ? [approvedVerification]
    : await db
        .select({ status: identityVerificationsTable.status })
        .from(identityVerificationsTable)
        .where(eq(identityVerificationsTable.userId, userId))
        .orderBy(desc(identityVerificationsTable.createdAt))
        .limit(1);

  const status = mapDiditStatusToAccountLimitStatus(latestVerification?.status ?? null);
  const monthlyLimit = getMonthlyAccountLimit(status);
  const { periodStart, periodEnd } = getUtcMonthRange(now);

  const [usage] = await db
    .select({
      sentAmount: sql<unknown>`coalesce(sum(${transactionsTable.amountMinor}), 0)`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.currency, "XOF"),
        inArray(transactionsTable.kind, ["inter-network", "international"]),
        eq(transactionsTable.status, "succeeded"),
        gte(transactionsTable.createdAt, periodStart),
        lt(transactionsTable.createdAt, periodEnd),
      ),
    );

  const sentAmount = Number(usage?.sentAmount ?? 0);
  if (!Number.isSafeInteger(sentAmount) || sentAmount < 0) {
    throw new Error("Account limit usage is outside the safe integer range");
  }

  return {
    status,
    currency: "XOF" as const,
    monthlyLimit,
    sentAmount,
    remainingAmount: Math.max(0, monthlyLimit - sentAmount),
    periodStart,
    periodEnd,
  };
}
