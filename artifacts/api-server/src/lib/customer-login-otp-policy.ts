export const CUSTOMER_LOGIN_OTP_AFTER_MS = 24 * 60 * 60 * 1000;

export function requiresCustomerLoginOtp(
  lastLoginCompletedAt: Date | null | undefined,
  now = new Date(),
) {
  if (!(lastLoginCompletedAt instanceof Date)) return true;

  const lastLogin = lastLoginCompletedAt.getTime();
  const currentTime = now.getTime();
  if (
    !Number.isFinite(lastLogin)
    || !Number.isFinite(currentTime)
    || lastLogin > currentTime
  ) {
    return true;
  }

  return currentTime - lastLogin >= CUSTOMER_LOGIN_OTP_AFTER_MS;
}
