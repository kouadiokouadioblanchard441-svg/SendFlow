export type AccountLimitStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed"
  | "review";

export function getUtcMonthRange(now: Date) {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export function getRemainingMonthlyAccountLimit(
  monthlyLimitMinor: number,
  sentAmountMinor: number,
  pendingAmountMinor: number,
): number {
  if (!Number.isSafeInteger(monthlyLimitMinor) || monthlyLimitMinor < 0
    || !Number.isSafeInteger(sentAmountMinor) || sentAmountMinor < 0
    || !Number.isSafeInteger(pendingAmountMinor) || pendingAmountMinor < 0
    || !Number.isSafeInteger(sentAmountMinor + pendingAmountMinor)) {
    throw new Error("Monthly outgoing limit values are invalid");
  }
  return Math.max(0, monthlyLimitMinor - sentAmountMinor - pendingAmountMinor);
}

export function isWithinMonthlyAccountLimit(requestedAmountMinor: number, remainingAmountMinor: number) {
  return Number.isSafeInteger(requestedAmountMinor)
    && requestedAmountMinor > 0
    && Number.isSafeInteger(remainingAmountMinor)
    && remainingAmountMinor >= 0
    && requestedAmountMinor <= remainingAmountMinor;
}
