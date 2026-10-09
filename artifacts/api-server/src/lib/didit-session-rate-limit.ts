export const DIDIT_SESSION_ATTEMPT_LIMIT = 3;
export const DIDIT_SESSION_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getDiditSessionRetryAfter(
  createdAt: Date[],
  now = new Date(),
): number | null {
  const cutoff = now.getTime() - DIDIT_SESSION_ATTEMPT_WINDOW_MS;
  const recentAttempts = createdAt
    .map((date) => date.getTime())
    .filter((time) => Number.isFinite(time) && time > cutoff)
    .sort((left, right) => left - right);

  if (recentAttempts.length < DIDIT_SESSION_ATTEMPT_LIMIT) return null;

  const nextAvailableAt = recentAttempts[0] + DIDIT_SESSION_ATTEMPT_WINDOW_MS;
  return Math.max(1, Math.ceil((nextAvailableAt - now.getTime()) / 1000));
}
