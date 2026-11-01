export type AccountLimitStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed"
  | "review";

export function getMonthlyAccountLimit() {
  // Until a replacement verification flow is implemented, no historical
  // provider status may grant the elevated monthly limit.
  return 150_000;
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
