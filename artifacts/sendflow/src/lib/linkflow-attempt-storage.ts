export interface StoredLinkFlowAttempt {
  attemptId: string;
  pollToken: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pollTokenPattern = /^[a-f0-9]{64}$/;

export function parseStoredLinkFlowAttempt(value: string | null): StoredLinkFlowAttempt | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const attempt = parsed as Record<string, unknown>;
    if (typeof attempt.attemptId !== "string" ||
      typeof attempt.pollToken !== "string" ||
      !uuidPattern.test(attempt.attemptId) ||
      !pollTokenPattern.test(attempt.pollToken)) {
      return null;
    }
    return { attemptId: attempt.attemptId, pollToken: attempt.pollToken };
  } catch {
    return null;
  }
}

export function parseStoredLinkFlowIdempotencyKey(value: string | null): string {
  return value && uuidPattern.test(value) ? value : "";
}
