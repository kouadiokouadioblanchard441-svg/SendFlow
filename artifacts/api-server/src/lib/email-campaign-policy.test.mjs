import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignRetryDelayMs,
  isCampaignDispatchEnabled,
  isRetryableCampaignEmailFailure,
} from "./email-campaign-policy.ts";

test("campaign dispatch is closed unless production, explicit enablement, and Resend config are present", () => {
  const base = {
    EMAIL_CAMPAIGNS_ENABLED: "true",
    RESEND_API_KEY: "test-key",
    RESEND_FROM_EMAIL: "SendFlow <no-reply@sendflow.africa>",
  };
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "development" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production", EMAIL_CAMPAIGNS_ENABLED: "false" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production", RESEND_FROM_EMAIL: "" }), false);
  assert.equal(isCampaignDispatchEnabled({ ...base, NODE_ENV: "production" }), true);
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
