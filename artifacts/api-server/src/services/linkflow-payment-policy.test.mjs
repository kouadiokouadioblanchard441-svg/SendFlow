import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLinkFlowRequestHash,
  deriveLinkFlowPollToken,
  hashLinkFlowPollToken,
  isLinkFlowPaymentExecutionEnabled,
  isLinkFlowProviderExecutionEnabled,
  resolveInitialProviderState,
  resolveVerifiedProviderState,
} from "./linkflow-payment-policy.ts";

const originalKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY;
process.env.CUSTOMER_PII_ENCRYPTION_KEY = "a".repeat(64);

test("live LinkFlow is disabled unless the explicitly approved production Plesk configuration is complete", () => {
  assert.equal(isLinkFlowPaymentExecutionEnabled({}), false);
  const feexpayEnvironment = {
    FEEXPAY_LINKFLOW_ENABLED: "true",
    FEEXPAY_MODE: "live",
    FEEXPAY_EXECUTION_HOST: "plesk",
    SENDFLOW_DATABASE_TARGET: "production",
    FEEXPAY_LIVE_ENABLED: "true",
    NODE_ENV: "production",
    FEEXPAY_API_KEY: "synthetic",
    FEEXPAY_SHOP_ID: "synthetic_shop",
    FEEXPAY_LIVE_APPROVED: "true",
  };
  assert.equal(isLinkFlowProviderExecutionEnabled("feexpay", feexpayEnvironment), true);
  assert.equal(isLinkFlowPaymentExecutionEnabled(feexpayEnvironment), true);
  assert.equal(isLinkFlowProviderExecutionEnabled("paydunya", {
    PAYDUNYA_LINKFLOW_ENABLED: "true",
    PAYDUNYA_MODE: "live",
    PAYDUNYA_EXECUTION_HOST: "plesk",
    SENDFLOW_DATABASE_TARGET: "production",
    PAYDUNYA_LIVE_ENABLED: "true",
    NODE_ENV: "production",
    PAYDUNYA_MASTER_KEY: "synthetic-master-key",
    PAYDUNYA_PRIVATE_KEY: "synthetic-private-key",
    PAYDUNYA_TOKEN: "synthetic-token",
  }), true);
  assert.equal(isLinkFlowProviderExecutionEnabled("paydunya", {
    PAYDUNYA_LINKFLOW_ENABLED: "true",
    PAYDUNYA_MODE: "live",
    PAYDUNYA_EXECUTION_HOST: "plesk",
    SENDFLOW_DATABASE_TARGET: "production",
    PAYDUNYA_LIVE_ENABLED: "true",
    NODE_ENV: "production",
    PAYDUNYA_MASTER_KEY: "synthetic-master-key",
    PAYDUNYA_PRIVATE_KEY: "synthetic-private-key",
  }), false);
});

test("the provider's initial POST response never becomes a final payer state", () => {
  assert.equal(resolveInitialProviderState({
    reference: "PAYREF123456",
    status: "SUCCESSFUL",
    amountMinor: 2000,
    currency: "XOF",
  }), "waiting");
  assert.equal(resolveInitialProviderState(null), "uncertain");
});

test("final status requires authenticated provider status, exact reference, amount, phone and XOF channel", () => {
  const expected = {
    reference: "PAYREF123456", amountMinor: 2000, currency: "XOF",
    channelId: "mtn-ci", phoneNumber: "22501020304",
  };
  assert.equal(resolveVerifiedProviderState({
    reference: expected.reference, status: "PENDING", amountMinor: 2000, currency: "XOF",
  }, expected), "waiting");
  assert.equal(resolveVerifiedProviderState({
    reference: expected.reference, status: "SUCCESSFUL", amountMinor: 2000, currency: "XOF",
    phoneNumber: expected.phoneNumber, verifiedStatusOperation: "payin",
  }, expected), "uncertain");
  const verified = { phoneNumber: expected.phoneNumber, verifiedStatusOperation: "payin" };
  assert.equal(resolveVerifiedProviderState({
    reference: expected.reference, status: "SUCCESSFUL", amountMinor: 2000, currency: "XOF",
    ...verified,
  }, expected), "succeeded");
  assert.equal(resolveVerifiedProviderState({
    reference: expected.reference, status: "FAILED", amountMinor: 2000,
    ...verified,
  }, expected), "failed");
  assert.equal(resolveVerifiedProviderState({
    reference: expected.reference, status: "SUCCESSFUL", currency: "XOF", ...verified,
  }, expected), "uncertain");
  assert.equal(resolveVerifiedProviderState({
    reference: expected.reference, status: "FAILED", amountMinor: 1999, currency: "XOF", ...verified,
  }, expected), "uncertain");
  assert.equal(resolveVerifiedProviderState({
    reference: expected.reference, status: "SUCCESSFUL", amountMinor: 2000,
    phoneNumber: "22501020305", verifiedStatusOperation: "payin",
  }, expected), "uncertain");
});

test("request fingerprints and poll tokens are stable without storing raw payer phone", () => {
  const input = {
    linkId: "link-1",
    countryCode: "ci",
    operatorId: "mtn_ci",
    phoneNumber: "+2250102030405",
    firstName: "Awa",
    lastName: "Kouassi",
    amountMinor: 2500,
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
  };
  assert.equal(buildLinkFlowRequestHash(input), buildLinkFlowRequestHash(input));
  assert.notEqual(buildLinkFlowRequestHash(input), buildLinkFlowRequestHash({
    ...input, phoneNumber: "+2250102030406",
  }));
  assert.notEqual(buildLinkFlowRequestHash(input), buildLinkFlowRequestHash({
    ...input, amountMinor: 2600,
  }));
  const challengeStart = { ...input, otpFlow: "provider_challenge" };
  assert.equal(
    buildLinkFlowRequestHash({ ...challengeStart, otp: undefined }),
    buildLinkFlowRequestHash({ ...challengeStart, otp: "123456" }),
  );
  const preAcquiredOtp = { ...input, otpFlow: "pre_acquired" };
  const otpHash = buildLinkFlowRequestHash({ ...preAcquiredOtp, otp: "123456" });
  assert.notEqual(otpHash, buildLinkFlowRequestHash({ ...preAcquiredOtp, otp: "654321" }));
  assert.equal(otpHash.includes("123456"), false);
  const token = deriveLinkFlowPollToken(input.linkId, input.idempotencyKey);
  assert.equal(token, deriveLinkFlowPollToken(input.linkId, input.idempotencyKey));
  assert.notEqual(hashLinkFlowPollToken(token), token);
});

test.after(() => {
  if (originalKey === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  else process.env.CUSTOMER_PII_ENCRYPTION_KEY = originalKey;
});
