const protectedCustomerPaths = new Set([
  '/account',
  '/account-info',
  '/account-limit',
  '/customer-service',
  '/deposit',
  '/international-transfer',
  '/inter-transfer',
  '/history',
  '/notifications',
  '/change-pin',
  '/change-pin-success',
  '/pricing',
]);

export function requiresCustomerPinUnlock(path: string) {
  return protectedCustomerPaths.has(path)
    || path.startsWith('/transaction/')
    || path.startsWith('/notifications/');
}

export function shouldRelockCustomerPinUnlock(
  pinUnlocked: boolean | undefined,
  sessionStatusCode: number | undefined,
) {
  return pinUnlocked === false
    || (sessionStatusCode !== undefined && sessionStatusCode >= 400 && sessionStatusCode < 600);
}
