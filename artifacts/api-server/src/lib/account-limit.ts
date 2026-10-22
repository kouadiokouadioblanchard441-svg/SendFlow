import {
  and,
  db,
  eq,
  gte,
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
import { loadLatestIdentityVerification } from "../data/identity-verification";

export async function getAccountLimitSnapshot(userId: string, now = new Date()) {
  const latestVerification = await loadLatestIdentityVerification(userId);

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
