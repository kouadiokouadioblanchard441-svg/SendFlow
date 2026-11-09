import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSensitiveDataLookupIndex,
  encryptSensitiveData,
} from "../lib/sensitive-data-crypto.ts";
import { resolveVerifiedFinalStatus } from "./payout-settlement-verification.ts";

const originalKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY;
process.env.CUSTOMER_PII_ENCRYPTION_KEY = "p".repeat(64);

const payoutId = "3a728694-5e70-4e58-84a4-4a620868c111";
const phone = "+2250102030405";
const providerReference = "FEEXPAYREF123456";
const payout = {
  id: payoutId,
  beneficiaryPhoneEncrypted: encryptSensitiveData(phone, "payout-beneficiary-phone", {
    authenticatedContext: payoutId,
  }),
  beneficiaryPhoneHash: createSensitiveDataLookupIndex(phone, "payout-beneficiary-phone"),
  beneficiaryAmountMinor: 9_800,
  currency: "XOF",
  countryCode: "ci",
  operatorId: "mtn-ci",
  executionReferenceEncrypted: encryptSensitiveData(providerReference, "provider-reference", {
    authenticatedContext: payoutId,
  }),
};
const attempt = {
  executionReferenceHash: createSensitiveDataLookupIndex(providerReference, "provider-reference"),
  expectedExecutionAccountHash: "b".repeat(64),
  expectedExecutionChannelId: "mtn-ci",
};
const verified = {
  reference: providerReference,
  status: "SUCCESSFUL",
  amountMinor: 9_800,
  verifiedStatusOperation: "payout",
};

test("payout completion needs the authenticated exact reference, amount, operation and channel", () => {
  assert.equal(resolveVerifiedFinalStatus(payout, attempt, verified), true);
  assert.equal(resolveVerifiedFinalStatus(payout, attempt, { ...verified, status: "PENDING" }), false);
  assert.equal(resolveVerifiedFinalStatus(payout, attempt, { ...verified, amountMinor: 9_799 }), false);
  assert.equal(resolveVerifiedFinalStatus(payout, attempt, { ...verified, currency: "XAF" }), false);
  assert.equal(resolveVerifiedFinalStatus(payout, attempt, { ...verified, reference: "FEEXPAYREF654321" }), false);
  assert.equal(resolveVerifiedFinalStatus(payout, attempt, {
    ...verified, phoneNumber: "2250102030406",
  }), false);
  assert.equal(resolveVerifiedFinalStatus(payout, attempt, {
    ...verified, verifiedStatusOperation: "payin",
  }), false);
  assert.equal(resolveVerifiedFinalStatus(payout, { ...attempt, expectedExecutionChannelId: "orange-ci" }, verified), false);
  assert.equal(resolveVerifiedFinalStatus(payout, {
    ...attempt,
    executionReferenceHash: createSensitiveDataLookupIndex("another-reference", "provider-reference"),
  }, verified), false);
});

test.after(() => {
  if (originalKey === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  else process.env.CUSTOMER_PII_ENCRYPTION_KEY = originalKey;
});
