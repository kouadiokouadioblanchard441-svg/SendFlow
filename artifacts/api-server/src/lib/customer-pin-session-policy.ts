export function createCustomerPinRotationSessionPolicy(
  userId: string,
  currentSessionId: string,
  now: Date,
  unlockTtlMs: number,
) {
  return {
    relockActiveSessionsForUserId: userId,
    currentSessionId,
    unlockCurrentSessionUntil: new Date(now.getTime() + unlockTtlMs),
  };
}
