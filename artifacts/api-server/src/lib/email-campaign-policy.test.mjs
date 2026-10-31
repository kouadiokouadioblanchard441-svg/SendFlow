import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignRetryDelayMs,
  campaignProviderIdempotencyKey,
  canManuallyRetryCampaignRecipient,
  getEmailCampaignConfiguration,
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
    EMAIL_CAMPAIGN_WEBHOOK_READY: "true",
    RESEND_API_KEY: "test-key",
    RESEND_WEBHOOK_SECRET: "w".repeat(32),
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
    emailLookupHash: "a".repeat(64),
    emailSnapshotLookupHash: "a".repeat(64),
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
    emailLookupHash: "a".repeat(64),
    emailSnapshotLookupHash: "a".repeat(64),
  };
  assert.equal(canManuallyRetryCampaignRecipient({ status: "failed", manualRetries: 0, recipient }), true);
  assert.equal(canManuallyRetryCampaignRecipient({ status: "sending", manualRetries: 0, recipient }), false);
  assert.equal(canManuallyRetryCampaignRecipient({ status: "failed", manualRetries: 3, recipient }), false);
  assert.equal(canManuallyRetryCampaignRecipient({
    status: "failed",
    manualRetries: 0,
    lastErrorClass: "network_or_response",
    recipient,
  }), false);
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

test("campaign dispatch requires a configured signed provider webhook", () => {
  const env = {
    NODE_ENV: "production",
    EMAIL_CAMPAIGNS_ENABLED: "true",
    EMAIL_CAMPAIGN_WEBHOOK_READY: "true",
    RESEND_API_KEY: "key",
    RESEND_FROM_EMAIL: "SendFlow <no-reply@sendflow.africa>",
    RESEND_WEBHOOK_SECRET: "w".repeat(32),
    SENDFLOW_PUBLIC_SITE_URL: "https://merchant.business.sendflow.africa",
    EMAIL_UNSUBSCRIBE_SECRET: "u".repeat(32),
  };
  assert.equal(isCampaignDispatchEnabled(env), true);
  assert.equal(isCampaignDispatchEnabled({ ...env, RESEND_WEBHOOK_SECRET: "" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...env, EMAIL_CAMPAIGN_WEBHOOK_READY: "false" }), false);
  assert.equal(getEmailCampaignConfiguration(env).attachmentsEnabled, false);
  assert.equal(getEmailCampaignConfiguration(env).manualRetryLimitPerRecipient, 3);
});

test("a provider suppression or changed email lookup hash blocks campaign eligibility", () => {
  const eligible = {
    accountStatus: "active",
    emailEncrypted: "encrypted-address",
    emailVerifiedAt: new Date(),
    emailMarketingConsentAt: new Date(),
    emailMarketingUnsubscribedAt: null,
    emailLookupHash: "a".repeat(64),
    emailSnapshotLookupHash: "a".repeat(64),
  };
  assert.equal(isCampaignRecipientEligible({ ...eligible, providerSuppressed: true }), false);
  assert.equal(isCampaignRecipientEligible({ ...eligible, emailLookupHash: "b".repeat(64) }), false);
  assert.equal(isCampaignRecipientEligible({ ...eligible, emailSnapshotLookupHash: null }), false);
});
