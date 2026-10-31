export type CampaignDispatchEnvironment = {
  NODE_ENV?: string;
  EMAIL_CAMPAIGNS_ENABLED?: string;
  EMAIL_CAMPAIGN_WEBHOOK_READY?: string;
  RESEND_API_KEY?: string;
  RESEND_WEBHOOK_SECRET?: string;
  RESEND_FROM_EMAIL?: string;
  SENDFLOW_PUBLIC_SITE_URL?: string;
  EMAIL_UNSUBSCRIBE_SECRET?: string;
};

export function isCampaignDispatchEnabled(env: CampaignDispatchEnvironment) {
  return env.NODE_ENV === "production"
    && env.EMAIL_CAMPAIGNS_ENABLED?.trim().toLowerCase() === "true"
    && env.EMAIL_CAMPAIGN_WEBHOOK_READY?.trim().toLowerCase() === "true"
    && Boolean(env.RESEND_API_KEY?.trim())
    && (env.RESEND_WEBHOOK_SECRET?.trim().length ?? 0) >= 32
    && Boolean(env.RESEND_FROM_EMAIL?.trim())
    && isHttpsSiteUrl(env.SENDFLOW_PUBLIC_SITE_URL)
    && (env.EMAIL_UNSUBSCRIBE_SECRET?.trim().length ?? 0) >= 32;
}

function isHttpsSiteUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && url.pathname === "/";
  } catch {
    return false;
  }
}

export function isRetryableCampaignEmailFailure(statusCode: number | null) {
  return statusCode === null || statusCode === 429 || (statusCode >= 500 && statusCode <= 599);
}

export type CampaignRecipientEligibility = {
  accountStatus: string;
  emailEncrypted: string | null;
  emailVerifiedAt: Date | string | null;
  emailMarketingConsentAt: Date | string | null;
  emailMarketingUnsubscribedAt: Date | string | null;
  emailLookupHash?: string | null;
  emailSnapshotLookupHash?: string | null;
  providerSuppressed?: boolean;
};

export function isCampaignRecipientEligible(recipient: CampaignRecipientEligibility) {
  return recipient.accountStatus === "active"
    && Boolean(recipient.emailEncrypted)
    && Boolean(recipient.emailVerifiedAt)
    && Boolean(recipient.emailMarketingConsentAt)
    && !recipient.emailMarketingUnsubscribedAt
    && !recipient.providerSuppressed
    && Boolean(recipient.emailLookupHash)
    && recipient.emailSnapshotLookupHash === recipient.emailLookupHash;
}

export function canManuallyRetryCampaignRecipient(input: {
  status: string;
  manualRetries: number;
  lastErrorClass?: string | null;
  recipient: CampaignRecipientEligibility;
}) {
  return input.status === "failed"
    && input.lastErrorClass !== "network_or_response"
    && input.lastErrorClass !== "delivery_outcome_unknown"
    && Number.isInteger(input.manualRetries)
    && input.manualRetries >= 0
    && input.manualRetries < 3
    && isCampaignRecipientEligible(input.recipient);
}

export function campaignProviderIdempotencyKey(recipientId: string, manualRetries: number) {
  const base = `sf-campaign-${recipientId}`;
  return manualRetries === 0 ? base : `${base}-retry-${manualRetries}`;
}

export function campaignRetryDelayMs(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(Math.trunc(attempt), 4));
  return Math.min(30_000 * (2 ** (boundedAttempt - 1)), 8 * 60_000);
}

export function getEmailCampaignConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return {
    sendingEnabled: isCampaignDispatchEnabled(env),
    webhookConfigured: Boolean(env.RESEND_WEBHOOK_SECRET?.trim() && env.RESEND_WEBHOOK_SECRET.trim().length >= 32),
    providerEventsReady: env.EMAIL_CAMPAIGN_WEBHOOK_READY?.trim().toLowerCase() === "true",
    unsubscribeConfigured: Boolean(env.EMAIL_UNSUBSCRIBE_SECRET?.trim() && env.EMAIL_UNSUBSCRIBE_SECRET.trim().length >= 32),
    attachmentsEnabled: false as const,
    automaticAttemptLimit: 4,
    manualRetryLimitPerRecipient: 3,
    queueLimitPerAdminPerHour: 10,
    retryLimitPerAdminPer15Minutes: 20,
  };
}
