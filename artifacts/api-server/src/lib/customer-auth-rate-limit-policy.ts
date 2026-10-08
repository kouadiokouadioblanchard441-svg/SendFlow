export type AuthRateLimitPolicy = {
  maxFailures: number;
  failureWindowMs: number;
  lockoutDurationMs: number;
};

export const GENERAL_AUTH_RATE_LIMIT_POLICY = {
  maxFailures: 5,
  failureWindowMs: 15 * 60 * 1000,
  lockoutDurationMs: 15 * 60 * 1000,
} as const satisfies AuthRateLimitPolicy;

export const CUSTOMER_ACCESS_RATE_LIMIT_POLICY = {
  maxFailures: 3,
  failureWindowMs: 20 * 60 * 1000,
  lockoutDurationMs: 20 * 60 * 1000,
} as const satisfies AuthRateLimitPolicy;

export function getAuthFailureWindowStart(now: Date, policy: AuthRateLimitPolicy) {
  return new Date(now.getTime() - policy.failureWindowMs);
}

export function getAuthLockoutExpiry(now: Date, policy: AuthRateLimitPolicy) {
  return new Date(now.getTime() + policy.lockoutDurationMs);
}

export function formatAuthRateLimitMessage(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Trop de tentatives. Réessayez dans ${minutes} min.`;
}
