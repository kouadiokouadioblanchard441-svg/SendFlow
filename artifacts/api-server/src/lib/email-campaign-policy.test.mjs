import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignRetryDelayMs,
  campaignProviderIdempotencyKey,
  canManuallyRetryCampaignRecipient,
  isCampaignDispatchEnabled,
  isCampaignRecipientEligible,
  isRetryableCampaignEmailFailure,
} from "./email-campaign-policy.ts";
import {
  createEmailUnsubscribeToken,
  verifyEmailUnsubscribeToken,
} from "./email-marketing-unsubscribe.ts";

test("campaign dispatch is closed unless production, explicit enablement, and Resend config are present", () => {
  const base = {
    EMAIL_CAMPAIGNS_ENABLED: "true",
    RESEND_API_KEY: "test-key",
    RESEND_FROM_EMAIL: "SendFlow <no-reply@sendflow.africa>",
    SENDFLOW_PUBLIC_SITE_URL: "https://merchant.business.sendflow.africa",
    EMAIL_UNSUBSCRIBE_SECRET: "x".repeat(32),
  };
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "development" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production", EMAIL_CAMPAIGNS_ENABLED: "false" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production", RESEND_FROM_EMAIL: "" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production", SENDFLOW_PUBLIC_SITE_URL: "http://merchant.business.sendflow.africa" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production", EMAIL_UNSUBSCRIBE_SECRET: "short" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production" }), true);
});

test("marketing audience eligibility requires an active, verified, opted-in address", () => {
  const eligible = {
    accountStatus: "active",
    emailEncrypted: "encrypted-address",
    emailVerifiedAt: new Date(),
    emailMarketingConsentAt: new Date(),
    emailMarketingUnsubscribedAt: null,
  };
  assert.equal(isCampaignRecipientEligible(eligible), true);
  assert.equal(isCampaignRecipientEligible({ ...eligible, accountStatus: "suspended" }), false);
  assert.equal(isCampaignRecipientEligible({ ...eligible, emailVerifiedAt: null }), false);
  assert.equal(isCampaignRecipientEligible({ ...eligible, emailMarketingConsentAt: null }), false);
  assert.equal(isCampaignRecipientEligible({ ...eligible, emailMarketingUnsubscribedAt: new Date() }), false);
});

test("manual retries are limited to eligible failed deliveries and at most three", () => {
  const recipient = {
    accountStatus: "active",
    emailEncrypted: "encrypted-address",
    emailVerifiedAt: new Date(),
    emailMarketingConsentAt: new Date(),
    emailMarketingUnsubscribedAt: null,
  };
  assert.equal(canManuallyRetryCampaignRecipient({ status: "failed", manualRetries: 0, recipient }), true);
  assert.equal(canManuallyRetryCampaignRecipient({ status: "sending", manualRetries: 0, recipient }), false);
  assert.equal(canManuallyRetryCampaignRecipient({ status: "failed", manualRetries: 3, recipient }), false);
  assert.equal(canManuallyRetryCampaignRecipient({
    status: "failed",
    manualRetries: 0,
    recipient: { ...recipient, emailMarketingUnsubscribedAt: new Date() },
  }), false);
});

test("provider idempotency remains stable within a delivery cycle and changes for an explicit retry", () => {
  assert.equal(campaignProviderIdempotencyKey("delivery-1", 0), "sf-campaign-delivery-1");
  assert.equal(campaignProviderIdempotencyKey("delivery-1", 1), "sf-campaign-delivery-1-retry-1");
});

test("unsubscribe links are signed, verifiable, and reject tampering", () => {
  const secret = "s".repeat(32);
  const token = createEmailUnsubscribeToken("user-123", secret);
  assert.equal(verifyEmailUnsubscribeToken(token, secret), "user-123");
  assert.equal(verifyEmailUnsubscribeToken(`${token.slice(0, -1)}A`, secret), null);
  assert.equal(verifyEmailUnsubscribeToken(token, "t".repeat(32)), null);
  assert.equal(verifyEmailUnsubscribeToken("not-a-token", secret), null);
});

test("only network, rate-limit, and server failures are retried", () => {
  assert.equal(isRetryableCampaignEmailFailure(null), true);
  assert.equal(isRetryableCampaignEmailFailure(429), true);
  assert.equal(isRetryableCampaignEmailFailure(503), true);
  assert.equal(isRetryableCampaignEmailFailure(401), false);
  assert.equal(isRetryableCampaignEmailFailure(422), false);
});

test("campaign retry delay is exponential and bounded", () => {
  assert.equal(campaignRetryDelayMs(1), 30_000);
  assert.equal(campaignRetryDelayMs(2), 60_000);
  assert.equal(campaignRetryDelayMs(3), 120_000);
  assert.equal(campaignRetryDelayMs(4), 240_000);
  assert.equal(campaignRetryDelayMs(10), 240_000);
});
