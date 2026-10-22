import assert from "node:assert/strict";
import test from "node:test";
import { calculateCustomerTransferQuote } from "./transfer-quote.ts";

const dependencies = () => ({
  operators: [{ operatorId: "source", countryCode: "ci" }, { operatorId: "destination", countryCode: "ci" }],
  rates: [{ operatorId: "source", categoryId: "inter-network", feePercent: 2, version: 4 }],
  countries: [{ countryCode: "CI", phonePrefix: "+225" }],
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
test("invalid amounts, foreign numbers, unsupported operators and exceeded limits fail closed", async () => {
  for (const extra of [{ amountMinor: -1 }, { amountMinor: 1.5 }, { amountMinor: Infinity },
    { amountMinor: 100_001 }, { destinationOperatorId: "source" }, { recipientPhone: "+99900" }]) {
    await assert.rejects(calculateCustomerTransferQuote("server-customer", input(extra), dependencies()));
  }
  await assert.rejects(calculateCustomerTransferQuote("", input(), dependencies()));
  await assert.rejects(calculateCustomerTransferQuote("server-customer", input(), { ...dependencies(), rates: [] }));
});
