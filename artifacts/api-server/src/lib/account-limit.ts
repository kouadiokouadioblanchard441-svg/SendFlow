import {
  and,
  db,
  eq,
  gte,
  inArray,
  lt,
  sql,
  transactionsTable,
  customerIdentityRequestsTable,
} from "@workspace/db";
import {
  getMonthlyAccountLimit,
  getUtcMonthRange,
} from "./account-limit-policy";

export async function getAccountLimitSnapshot(userId: string, now = new Date()) {
  const [latestVerification] = await db
    .select({ status: customerIdentityRequestsTable.status })
    .from(customerIdentityRequestsTable)
    .where(eq(customerIdentityRequestsTable.userId, userId))
    .orderBy(sql`${customerIdentityRequestsTable.submittedAt} desc`)
    .limit(1);
  const status = latestVerification?.status === "approved"
    ? "verified" as const
    : latestVerification?.status === "pending"
      ? "pending" as const
      : latestVerification?.status === "rejected"
        ? "failed" as const
        : "unverified" as const;
  const monthlyLimit = getMonthlyAccountLimit();
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
