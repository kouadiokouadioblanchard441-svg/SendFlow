export const CUSTOMER_SESSION_TTL_MS = 10 * 60 * 1000;

export function customerSessionExpiresAt(createdAt: Date) {
  return new Date(createdAt.getTime() + CUSTOMER_SESSION_TTL_MS);
}

export function isCustomerSessionPastMaximumAge(createdAt: Date, now = new Date()) {
  const createdAtMs = createdAt.getTime();
  const nowMs = now.getTime();
  return !Number.isFinite(createdAtMs)
    || !Number.isFinite(nowMs)
    || createdAtMs > nowMs
    || nowMs - createdAtMs >= CUSTOMER_SESSION_TTL_MS;
}

export function customerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_MS,
  };
}
