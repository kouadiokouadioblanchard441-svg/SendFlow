export type AccountLimitStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed"
  | "review";

export function mapDiditStatusToAccountLimitStatus(status: string | null): AccountLimitStatus {
  if (status === "Approved") return "verified";
  if (status === "Declined" || status === "Expired" || status === "Kyc Expired" || status === "Abandoned") {
    return "failed";
  }
  if (status === "In Review") return "review";
  return status === null ? "unverified" : "pending";
}

export function getMonthlyAccountLimit(status: AccountLimitStatus) {
  return status === "verified" ? 10_000_000 : 150_000;
}

export function getUtcMonthRange(now: Date) {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export function isWithinMonthlyAccountLimit(requestedAmountMinor: number, remainingAmountMinor: number) {
  return Number.isSafeInteger(requestedAmountMinor)
    && requestedAmountMinor > 0
    && Number.isSafeInteger(remainingAmountMinor)
    && remainingAmountMinor >= 0
    && requestedAmountMinor <= remainingAmountMinor;
}
