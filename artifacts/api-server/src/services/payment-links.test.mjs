import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePaymentLinkInput,
  parseLinkFlowPayerAmount,
} from "./payment-links.ts";

const baseInput = {
  requestId: "11111111-1111-4111-8111-111111111111",
  currency: "XOF",
  linkName: "Boutique",
  paymentMethod: "mobile_money",
  validity: "day",
  maximumUses: null,
  returnUrl: null,
  suffix: null,
};

test("LinkFlow creation accepts no fixed amount and no description as a payer-priced link", () => {
  const normalized = normalizePaymentLinkInput(baseInput, new Date("2026-10-26T00:00:00.000Z"));
  assert.equal(normalized.amountMinor, 0);
  assert.equal(normalized.description, "");
  assert.equal(normalized.currency, "XOF");
});

test("LinkFlow keeps supplied fixed amounts and descriptions unchanged", () => {
  const normalized = normalizePaymentLinkInput({
    ...baseInput,
    amount: "2500",
    description: "Facture",
  });
  assert.equal(normalized.amountMinor, 2500);
  assert.equal(normalized.description, "Facture");
});

test("payer-entered amount is required and bounded for variable XOF links", () => {
  assert.throws(() => parseLinkFlowPayerAmount(undefined, 0, "XOF"), /Saisissez le montant/);
  assert.throws(() => parseLinkFlowPayerAmount("99", 0, "XOF"), /100 et 2 000 000/);
  assert.equal(parseLinkFlowPayerAmount("100", 0, "XOF"), 100);
  assert.equal(parseLinkFlowPayerAmount("2000000", 0, "XOF"), 2_000_000);
  assert.throws(() => parseLinkFlowPayerAmount("2000001", 0, "XOF"), /100 et 2 000 000/);
});

test("variable amounts are not accepted for unsupported currencies", () => {
  assert.throws(
    () => normalizePaymentLinkInput({ ...baseInput, currency: "USD" }),
    /uniquement en XOF/,
  );
  assert.throws(
    () => parseLinkFlowPayerAmount("100", 0, "XAF"),
    /uniquement en XOF/,
  );
  assert.throws(
    () => normalizePaymentLinkInput({ ...baseInput, currency: "XAF", amount: "0" }),
    /uniquement en XOF/,
  );
});

test("fixed links use the saved amount and reject a payer-submitted replacement", () => {
  assert.equal(parseLinkFlowPayerAmount(undefined, 2500, "XOF"), 2500);
  assert.equal(parseLinkFlowPayerAmount("2500", 2500, "XOF"), 2500);
  assert.throws(() => parseLinkFlowPayerAmount("3000", 2500, "XOF"), /ne correspond pas/);
});
