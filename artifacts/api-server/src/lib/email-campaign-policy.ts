export type CampaignDispatchEnvironment = {
  NODE_ENV?: string;
  EMAIL_CAMPAIGNS_ENABLED?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

export function isCampaignDispatchEnabled(env: CampaignDispatchEnvironment) {
  return env.NODE_ENV === "production"
    && env.EMAIL_CAMPAIGNS_ENABLED?.trim().toLowerCase() === "true"
    && Boolean(env.RESEND_API_KEY?.trim())
    && Boolean(env.RESEND_FROM_EMAIL?.trim());
}

export function isRetryableCampaignEmailFailure(statusCode: number | null) {
  return statusCode === null || statusCode === 429 || (statusCode >= 500 && statusCode <= 599);
}

export function campaignRetryDelayMs(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(Math.trunc(attempt), 4));
  return Math.min(30_000 * (2 ** (boundedAttempt - 1)), 8 * 60_000);
}
