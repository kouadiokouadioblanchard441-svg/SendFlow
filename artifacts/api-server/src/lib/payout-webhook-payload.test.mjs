import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePayoutWebhookPayload,
  PayoutWebhookPayloadError,
} from "./payout-webhook-payload.ts";

const payload = (overrides = {}) => ({
  id: "6c5c9afe-2a49-4f2a-90f4-38cded950442",
  type: "payout.failed",
  createdAt: "2026-11-08T12:00:00.000Z",
  data: {
    amountMinor: 10_000,
    beneficiaryAmountMinor: 9_800,
    countryCode: "ci",
    currency: "XOF",
    feeMinor: 200,
    feePayer: "beneficiary",
    merchantReference: "invoice-45",
    operatorId: "orange-ci",
    payoutId: "c43c9b3a-3a7c-4a98-a8d3-80172b6a4bbf",
    providerFeeMinor: null,
    reference: "SFPO0123456789ABCDEF",
    status: "failed",
    totalDebitMinor: 10_000,
  },
  ...overrides,
});

test("payout webhook payload validates bounded financial fields without personal data", () => {
  assert.equal(normalizePayoutWebhookPayload(payload()).data.currency, "XOF");
  assert.throws(
    () => normalizePayoutWebhookPayload({
      ...payload(),
      data: { ...payload().data, beneficiaryPhone: "+2250102030405" },
    }),
    PayoutWebhookPayloadError,
  );
  assert.throws(
    () => normalizePayoutWebhookPayload({
      ...payload(),
      data: { ...payload().data, amountMinor: 2 ** 53 },
    }),
    PayoutWebhookPayloadError,
  );
});

test("payout.failed can honestly notify a pre-dispatch rejection or cancellation", () => {
  for (const status of ["failed", "rejected", "cancelled"]) {
    assert.equal(normalizePayoutWebhookPayload({
      ...payload(),
      data: { ...payload().data, status },
    }).data.status, status);
  }
  assert.throws(
    () => normalizePayoutWebhookPayload({
      ...payload(),
      type: "payout.failed",
      data: { ...payload().data, status: "succeeded" },
    }),
    PayoutWebhookPayloadError,
  );
});
