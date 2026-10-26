export interface StoredLinkFlowAttempt {
  attemptId: string;
  pollToken: string;
  expiresAt: number | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pollTokenPattern = /^[a-f0-9]{64}$/;

export const LINKFLOW_PAYMENT_TIMEOUT_SECONDS = 10 * 60;
export const LINKFLOW_PAYMENT_TIMEOUT_MS = LINKFLOW_PAYMENT_TIMEOUT_SECONDS * 1000;

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
    return {
      attemptId: attempt.attemptId,
      pollToken: attempt.pollToken,
      expiresAt: typeof attempt.expiresAt === "number" && Number.isFinite(attempt.expiresAt)
        ? attempt.expiresAt
        : null,
    };
  } catch {
    return null;
  }
}

export function getLinkFlowCountdownSeconds(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function shouldShowLinkFlowTimeoutFailure(
  secondsRemaining: number | null,
  paymentState: "waiting" | "uncertain" | "succeeded" | "failed" | undefined,
): boolean {
  return secondsRemaining === 0 && paymentState !== "succeeded" && paymentState !== "failed";
}

export function formatLinkFlowCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function parseStoredLinkFlowIdempotencyKey(value: string | null): string {
  return value && uuidPattern.test(value) ? value : "";
}
