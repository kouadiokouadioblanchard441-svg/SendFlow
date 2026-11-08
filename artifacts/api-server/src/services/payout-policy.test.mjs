import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPayoutWalletCanCover,
  calculatePayoutQuote,
  isMatchingPayoutSettlementEvidence,
  normalizePayoutPhone,
  PAYOUT_EXECUTION_ENABLED,
  PayoutPolicyError,
} from "./payout-policy.ts";

const configuration = {
  country: {
    countryCode: "ci",
    phonePrefix: "+225",
    minPhoneDigits: 10,
    maxPhoneDigits: 10,
    enabled: true,
    payoutEnabled: true,
  },
  operator: {
    operatorId: "orange-ci",
    countryCode: "ci",
    enabled: true,
    payoutEnabled: true,
  },
  feePercent: 2,
  pricingVersion: 4,
  minimumPayoutMinor: 200,
  maximumTransferMinor: 2_000_000,
  maximumPayoutDailyMinor: 1_000_000,
  executionRouteEnabled: true,
};
const input = (feePayer) => ({
  amountMinor: 10_000,
  currency: "XOF",
  countryCode: "ci",
  operatorId: "orange-ci",
  feePayer,
});

test("payout quotes calculate fee and debit from the selected fee payer", () => {
  const merchantPays = calculatePayoutQuote(input("merchant"), configuration);
  assert.equal(merchantPays.feeMinor, 200);
  assert.equal(merchantPays.totalDebitMinor, 10_200);
  assert.equal(merchantPays.beneficiaryAmountMinor, 10_000);
  assert.equal("executionBlockReason" in merchantPays, false);

  const beneficiaryPays = calculatePayoutQuote(input("beneficiary"), configuration);
  assert.equal(beneficiaryPays.feeMinor, 200);
  assert.equal(beneficiaryPays.totalDebitMinor, 10_000);
  assert.equal(beneficiaryPays.beneficiaryAmountMinor, 9_800);
});

test("payout quote fails closed for unconfigured limits, routing, country, or fee", () => {
  for (const invalid of [
    { ...configuration, maximumPayoutDailyMinor: null },
    { ...configuration, executionRouteEnabled: false },
    { ...configuration, operator: { ...configuration.operator, payoutEnabled: false } },
    { ...configuration, country: { ...configuration.country, payoutEnabled: false } },
    { ...configuration, feePercent: null },
  ]) {
    assert.throws(() => calculatePayoutQuote(input("merchant"), invalid), PayoutPolicyError);
  }
  assert.throws(
    () => calculatePayoutQuote({ ...input("merchant"), currency: "XAF" }, configuration),
    PayoutPolicyError,
  );
});

test("only fully correlated final settlement evidence matches a payout", () => {
  const payout = {
    executionReferenceHash: "d".repeat(64),
    beneficiaryAmountMinor: 9_800,
    currency: "XOF",
    countryCode: "ci",
    operatorId: "orange-ci",
    beneficiaryPhoneHash: "a".repeat(64),
    expectedExecutionAccountHash: "b".repeat(64),
    expectedExecutionChannelId: "orange-ci",
  };
  const evidence = {
    executionReferenceHash: payout.executionReferenceHash,
    executionStatus: "SUCCEEDED",
    amountMinor: payout.beneficiaryAmountMinor,
    currency: payout.currency,
    countryCode: payout.countryCode,
    operatorId: payout.operatorId,
    beneficiaryPhoneHash: payout.beneficiaryPhoneHash,
    executionAccountHash: payout.expectedExecutionAccountHash,
    executionChannelId: payout.expectedExecutionChannelId,
    operation: "payout",
    verificationPassed: true,
  };
  assert.equal(isMatchingPayoutSettlementEvidence(payout, evidence, "SUCCEEDED"), true);
  assert.equal(
    isMatchingPayoutSettlementEvidence(payout, { ...evidence, executionStatus: "FAILED" }, "SUCCEEDED"),
    false,
  );
  assert.equal(isMatchingPayoutSettlementEvidence(payout, { ...evidence, executionStatus: "FAILED" }, "FAILED"), true);
  for (const change of [
    { amountMinor: 1 },
    { currency: "XAF" },
    { countryCode: "sn" },
    { operatorId: "wave-ci" },
    { beneficiaryPhoneHash: "c".repeat(64) },
    { executionReferenceHash: "e".repeat(64) },
    { executionAccountHash: "c".repeat(64) },
    { executionChannelId: "mtn-ci" },
    { operation: "payin" },
    { verificationPassed: false },
  ]) {
    assert.equal(
      isMatchingPayoutSettlementEvidence(payout, { ...evidence, ...change }, "SUCCEEDED"),
      false,
    );
  }
});

test("payout phone normalization requires the selected country's prefix and length", () => {
  assert.equal(normalizePayoutPhone("+2250102030405", configuration.country), "+2250102030405");
  assert.throws(() => normalizePayoutPhone("+2210102030405", configuration.country), PayoutPolicyError);
  assert.throws(() => normalizePayoutPhone("+22501020304", configuration.country), PayoutPolicyError);
});

test("payout settlement remains unavailable in this build", () => {
  assert.equal(PAYOUT_EXECUTION_ENABLED, false);
});

test("payout quote cannot exceed the authenticated SendFlow wallet balance", () => {
  assert.doesNotThrow(() => assertPayoutWalletCanCover(10_200, 10_200));
  assert.throws(() => assertPayoutWalletCanCover(0, 1), PayoutPolicyError);
  assert.throws(() => assertPayoutWalletCanCover(10_199, 10_200), PayoutPolicyError);
});
