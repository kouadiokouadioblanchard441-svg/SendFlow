import { Webhook } from "svix";

export const CAMPAIGN_PROVIDER_EVENT_TYPES = [
  "email.delivered",
  "email.bounced",
  "email.complained",
] as const;

export type CampaignProviderEventType = (typeof CAMPAIGN_PROVIDER_EVENT_TYPES)[number];
export type CampaignProviderRecipientStatus = "accepted" | "delivered" | "bounced" | "complained" | "failed" | "cancelled";

export type CampaignProviderIdentifiers = {
  recipientId: string;
  attemptId: string;
};

export function verifyResendWebhook(
  rawBody: string | Buffer,
  headers: { id?: string | null; timestamp?: string | null; signature?: string | null },
  secret: string | undefined,
) {
  if (!secret || secret.trim().length < 32) {
    throw new Error("Webhook verification is not configured");
  }
  if (!headers.id || !headers.timestamp || !headers.signature) {
    throw new Error("Webhook signature headers are missing");
  }
  new Webhook(secret).verify(rawBody, {
    "svix-id": headers.id,
    "svix-timestamp": headers.timestamp,
    "svix-signature": headers.signature,
  });
  return JSON.parse(typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")) as unknown;
}

export function campaignProviderIdentifiers(tags: unknown): CampaignProviderIdentifiers | null {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return null;
  const candidate = tags as Record<string, unknown>;
  const recipientId = candidate.sendflow_campaign_recipient;
  const attemptId = candidate.sendflow_campaign_attempt;
  if (
    typeof recipientId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId)
    || typeof attemptId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)
  ) return null;
  return { recipientId, attemptId };
}

export function isCampaignProviderEventType(value: unknown): value is CampaignProviderEventType {
  return typeof value === "string"
    && (CAMPAIGN_PROVIDER_EVENT_TYPES as readonly string[]).includes(value);
}

export function campaignProviderStatusTransition(
  currentStatus: CampaignProviderRecipientStatus,
  currentProviderAt: Date | null,
  eventType: CampaignProviderEventType,
  occurredAt: Date,
): { status: CampaignProviderRecipientStatus; providerUpdatedAt: Date } {
  if (eventType === "email.complained") {
    return {
      status: "complained",
      providerUpdatedAt: currentStatus === "complained" && currentProviderAt && currentProviderAt > occurredAt
        ? currentProviderAt
        : occurredAt,
    };
  }
  if (eventType === "email.bounced") {
    if (currentStatus === "complained") {
      return { status: currentStatus, providerUpdatedAt: currentProviderAt ?? occurredAt };
    }
    return {
      status: "bounced",
      providerUpdatedAt: currentStatus === "bounced" && currentProviderAt && currentProviderAt > occurredAt
        ? currentProviderAt
        : occurredAt,
    };
  }
  if (
    currentStatus === "bounced"
    || currentStatus === "complained"
    || (currentProviderAt && occurredAt < currentProviderAt)
  ) {
    return { status: currentStatus, providerUpdatedAt: currentProviderAt ?? occurredAt };
  }
  return { status: "delivered", providerUpdatedAt: occurredAt };
}

export function campaignAdminActionWithinLimit(count: number, limit: number) {
  return Number.isInteger(count) && count >= 0 && Number.isInteger(limit) && limit > 0 && count < limit;
}
