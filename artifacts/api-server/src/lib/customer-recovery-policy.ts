/**
 * Call only after the recovery route has locked and validated the OTP row.
 * The database row lock ensures concurrent replays do not all perform scrypt
 * before the winning request consumes the challenge.
 */
export async function hashSecretForClaimedOtpChallenge<T>(
  challenge: T | null | undefined,
  deriveHash: () => Promise<string>,
): Promise<string | null> {
  if (challenge == null) return null;
  return deriveHash();
}
