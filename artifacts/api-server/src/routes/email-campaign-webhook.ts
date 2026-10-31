import { Router, type Request } from "express";
import { campaignProviderIdentifiers, isCampaignProviderEventType, verifyResendWebhook } from "../lib/email-campaign-provider-policy";
import { receiveCampaignProviderEvent } from "../services/email-campaign-provider-events";

type RawBodyRequest = Request & { rawBody?: Buffer };

const router = Router();

router.post("/webhooks/resend", async (req: RawBodyRequest, res): Promise<void> => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret?.trim() || secret.trim().length < 32) {
    res.status(503).json({ error: "Webhook verification is not configured" });
    return;
  }
  if (!req.rawBody?.length) {
    res.status(400).json({ error: "Invalid webhook request" });
    return;
  }

  let payload: unknown;
  try {
    payload = verifyResendWebhook(req.rawBody, {
      id: req.get("svix-id"),
      timestamp: req.get("svix-timestamp"),
      signature: req.get("svix-signature"),
    }, secret);
  } catch {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }
  const body = payload as Record<string, unknown>;
  if (!isCampaignProviderEventType(body.type)) {
    res.status(200).json({ received: true });
    return;
  }
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    res.status(200).json({ received: true });
    return;
  }
  const data = body.data as Record<string, unknown>;
  const identifiers = campaignProviderIdentifiers(data.tags);
  const providerEventId = req.get("svix-id")?.trim() ?? "";
  const providerMessageId = data.email_id;
  const occurredAtValue = data.created_at ?? body.created_at;
  const occurredAt = typeof occurredAtValue === "string" ? new Date(occurredAtValue) : null;
  if (
    !identifiers
    || !providerEventId
    || providerEventId.length > 255
    || typeof providerMessageId !== "string"
    || providerMessageId.length < 1
    || providerMessageId.length > 255
    || !occurredAt
    || !Number.isFinite(occurredAt.getTime())
  ) {
    // Other account emails and events without SendFlow's campaign correlation
    // tags are intentionally acknowledged but never enter campaign history.
    res.status(200).json({ received: true });
    return;
  }

  try {
    const result = await receiveCampaignProviderEvent({
      providerEventId,
      ...identifiers,
      providerMessageId,
      eventType: body.type,
      occurredAt,
    });
    res.status(200).json({ received: true });
  } catch {
    // A server error tells the provider to retry; never log payload or headers.
    req.log.error({ component: "email-campaign-webhook" }, "Verified email event could not be persisted");
    res.status(503).json({ error: "Webhook processing is temporarily unavailable" });
  }
});

export default router;
