export const DIDIT_SESSION_ATTEMPT_LIMIT = 3;
export const DIDIT_SESSION_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DIDIT_SESSION_CREATION_LEASE_MS = 60 * 1000;

function recentAttemptTimes(createdAt: Date[], now: Date, windowMs: number): number[] {
  const cutoff = now.getTime() - windowMs;
  return createdAt
    .map((date) => date.getTime())
    .filter((time) => Number.isFinite(time) && time > cutoff)
    .sort((left, right) => left - right);
}

export function getDiditSessionRetryAfter(
  createdAt: Date[],
  now = new Date(),
): number | null {
  const recentAttempts = recentAttemptTimes(
    createdAt,
    now,
    DIDIT_SESSION_ATTEMPT_WINDOW_MS,
  );

  if (recentAttempts.length < DIDIT_SESSION_ATTEMPT_LIMIT) return null;

  const nextAvailableAt = recentAttempts[0] + DIDIT_SESSION_ATTEMPT_WINDOW_MS;
  return Math.max(1, Math.ceil((nextAvailableAt - now.getTime()) / 1000));
}

export function getDiditSessionCreationRetryAfter(
  createdAt: Date[],
  now = new Date(),
): number | null {
  const pendingReservations = recentAttemptTimes(
    createdAt,
    now,
    DIDIT_SESSION_CREATION_LEASE_MS,
  );
  if (pendingReservations.length === 0) return null;

  const nextAvailableAt = pendingReservations[0] + DIDIT_SESSION_CREATION_LEASE_MS;
  return Math.max(1, Math.ceil((nextAvailableAt - now.getTime()) / 1000));
}
