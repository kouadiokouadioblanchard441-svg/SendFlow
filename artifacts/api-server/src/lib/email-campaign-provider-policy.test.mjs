import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "svix";
import {
  campaignAdminActionWithinLimit,
  campaignProviderIdentifiers,
  campaignProviderStatusTransition,
  isCampaignProviderEventType,
  verifyResendWebhook,
} from "./email-campaign-provider-policy.ts";

const recipientId = "89c7c8a4-0d91-4db2-9ed7-c26b83a98753";
const attemptId = "ad31ad17-51e0-4a57-95f3-87f1aa680e54";

test("provider campaign correlation accepts only valid SendFlow recipient and attempt tags", () => {
  assert.deepEqual(campaignProviderIdentifiers({
    sendflow_campaign_recipient: recipientId,
    sendflow_campaign_attempt: attemptId,
  }), { recipientId, attemptId });
  assert.equal(campaignProviderIdentifiers({ sendflow_campaign_recipient: recipientId }), null);
  assert.equal(campaignProviderIdentifiers({
    sendflow_campaign_recipient: recipientId,
    sendflow_campaign_attempt: "not-an-id",
  }), null);
});

test("only delivery, bounce, and complaint events enter campaign delivery processing", () => {
  assert.equal(isCampaignProviderEventType("email.delivered"), true);
  assert.equal(isCampaignProviderEventType("email.bounced"), true);
  assert.equal(isCampaignProviderEventType("email.complained"), true);
  assert.equal(isCampaignProviderEventType("email.opened"), false);
});

test("provider status transitions never downgrade a bounce or complaint", () => {
  const oldDate = new Date("2026-10-31T10:00:00.000Z");
  const newDate = new Date("2026-10-31T10:05:00.000Z");
  assert.deepEqual(
    campaignProviderStatusTransition("accepted", null, "email.delivered", oldDate),
    { status: "delivered", providerUpdatedAt: oldDate },
  );
  assert.equal(
    campaignProviderStatusTransition("delivered", oldDate, "email.bounced", oldDate).status,
    "bounced",
  );
  assert.equal(
    campaignProviderStatusTransition("bounced", oldDate, "email.delivered", newDate).status,
    "bounced",
  );
  assert.equal(
    campaignProviderStatusTransition("bounced", oldDate, "email.complained", oldDate).status,
    "complained",
  );
  assert.equal(
    campaignProviderStatusTransition("complained", newDate, "email.bounced", oldDate).status,
    "complained",
  );
});

test("webhook signature verification uses the exact raw body and rejects tampering", () => {
  const secret = `whsec_${Buffer.from("sendflow-webhook-test-secret").toString("base64")}`;
  const timestampDate = new Date();
  const body = JSON.stringify({
    type: "email.delivered",
    created_at: timestampDate.toISOString(),
    data: { email_id: "provider-message-1", tags: {} },
  });
  const id = "msg_test_event_01";
  const timestamp = String(Math.floor(timestampDate.getTime() / 1000));
  const signature = new Webhook(secret).sign(id, timestampDate, body);
  const headers = { id, timestamp, signature };

  assert.deepEqual(verifyResendWebhook(body, headers, secret), JSON.parse(body));
  assert.throws(() => verifyResendWebhook(`${body} `, headers, secret));
  assert.throws(() => verifyResendWebhook(body, headers, undefined));
});

test("database-backed campaign action limits reject invalid counts and enforce the configured ceiling", () => {
  assert.equal(campaignAdminActionWithinLimit(0, 10), true);
  assert.equal(campaignAdminActionWithinLimit(9, 10), true);
  assert.equal(campaignAdminActionWithinLimit(10, 10), false);
  assert.equal(campaignAdminActionWithinLimit(-1, 10), false);
});
