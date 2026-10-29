import assert from "node:assert/strict";
import test from "node:test";
import { calculateCustomerTransferQuote } from "./transfer-quote.ts";
import { DEFAULT_PAYMENT_LIMITS } from "./payment-limits-policy.ts";

const dependencies = () => ({
  operators: [
    {
      operatorId: "source",
      countryCode: "ci",
      enabled: true,
      depositEnabled: true,
      interNetworkEnabled: true,
      internationalEnabled: true,
    },
    {
      operatorId: "destination",
      countryCode: "ci",
      enabled: true,
      depositEnabled: true,
      interNetworkEnabled: true,
      internationalEnabled: true,
    },
  ],
  rates: [{ operatorId: "source", categoryId: "inter-network", feePercent: 2, version: 4 }],
  countries: [{
    countryCode: "CI",
    phonePrefix: "+225",
    enabled: true,
    depositEnabled: true,
    interNetworkEnabled: true,
    internationalEnabled: true,
    minPhoneDigits: 10,
    maxPhoneDigits: 10,
  }],
  limits: { ...DEFAULT_PAYMENT_LIMITS },
  remainingMonthlyAmount: async (id) => { assert.equal(id, "server-customer"); return 100_000; },
});
const input = (extra = {}) => ({
  kind: "inter-network", amountMinor: 10_000, senderPaysFees: true,
  sourceOperatorId: "source", destinationOperatorId: "destination",
  senderPhone: "+2250000000000", recipientPhone: "+2250000000001", ...extra,
});

test("server pricing ignores browser fees, total, identity and payment status", async () => {
  const result = await calculateCustomerTransferQuote("server-customer",
    input({ feeMinor: 0, totalDebitMinor: 1, userId: "other-customer", status: "succeeded" }), dependencies());
  assert.equal(result.feeMinor, 200);
  assert.equal(result.totalDebitMinor, 10_200);
  assert.equal(result.pricingVersion, 4);
  assert.equal(result.status, undefined);
});
test("recipient-paid fees preserve the debit and subtract from delivery", async () => {
  const result = await calculateCustomerTransferQuote("server-customer", input({ senderPaysFees: false }), dependencies());
  assert.equal(result.totalDebitMinor, 10_000);
  assert.equal(result.recipientAmountMinor, 9_800);
});
test("deposits use the configured minimum and transfers use their configured thresholds", async () => {
  const deposit = {
    kind: "deposit", amountMinor: 200, senderPaysFees: true,
    sourceOperatorId: "source", senderPhone: "+2250000000000",
  };
  const depositDependencies = {
    ...dependencies(),
    rates: [{ operatorId: "source", categoryId: "deposit", feePercent: 2, version: 5 }],
  };
  await assert.rejects(
    calculateCustomerTransferQuote("server-customer", { ...deposit, amountMinor: 199 }, depositDependencies),
    /minimum d’un dépôt est de 200 FCFA/,
  );
  const result = await calculateCustomerTransferQuote("server-customer", deposit, depositDependencies);
  assert.equal(result.amountMinor, 200);
  assert.equal(result.pricingVersion, 5);

  const higherMinimum = {
    ...depositDependencies,
    limits: { ...DEFAULT_PAYMENT_LIMITS, minimumDepositMinor: 500 },
  };
  await assert.rejects(
    calculateCustomerTransferQuote("server-customer", { ...deposit, amountMinor: 499 }, higherMinimum),
    /minimum d’un dépôt est de 500 FCFA/,
  );
  assert.equal(
    (await calculateCustomerTransferQuote("server-customer", { ...deposit, amountMinor: 500 }, higherMinimum)).amountMinor,
    500,
  );
});
test("invalid amounts, foreign numbers, unsupported operators and exceeded limits fail closed", async () => {
  for (const extra of [{ amountMinor: -1 }, { amountMinor: 1.5 }, { amountMinor: Infinity },
    { amountMinor: 100_001 }, { destinationOperatorId: "source" }, { recipientPhone: "+99900" }]) {
    await assert.rejects(calculateCustomerTransferQuote("server-customer", input(extra), dependencies()));
  }
  await assert.rejects(calculateCustomerTransferQuote("", input(), dependencies()));
  await assert.rejects(calculateCustomerTransferQuote("server-customer", input(), { ...dependencies(), rates: [] }));
});
