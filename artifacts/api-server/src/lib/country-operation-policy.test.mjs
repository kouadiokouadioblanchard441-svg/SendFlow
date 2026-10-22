import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCustomerTransferQuote } from "../services/transfer-quote.ts";

function fixtures() {
  const countries = ["ci", "cm"].map((countryCode) => ({
    countryCode, phonePrefix: countryCode === "ci" ? "+225" : "+237",
    enabled: true, depositEnabled: true, interNetworkEnabled: true, internationalEnabled: true,
    minPhoneDigits: countryCode === "ci" ? 10 : 9, maxPhoneDigits: countryCode === "ci" ? 10 : 9,
  }));
  const operators = ["orange-ci", "mtn-ci", "mtn-cm"].map((operatorId) => ({
    operatorId, countryCode: operatorId.endsWith("-ci") ? "ci" : "cm",
    enabled: true, depositEnabled: true, interNetworkEnabled: true, internationalEnabled: true,
  }));
  return {
    countries, operators,
    rates: operators.flatMap(({ operatorId }) => ["deposit", "inter-network", "international"]
      .map((categoryId) => ({ operatorId, categoryId, feePercent: 1, version: 1 }))),
    remainingMonthlyAmount: async () => 1000000,
  };
}
const deposit = {
  kind: "deposit", amountMinor: 10000, senderPaysFees: true,
  sourceOperatorId: "orange-ci", senderPhone: "+2250700000000",
};
test("server quote uses configured fee, not supplied client fee", async () => {
  const quote = await calculateCustomerTransferQuote("fixture", { ...deposit, feePercent: 0 }, fixtures());
  assert.equal(quote.feePercent, 1);
  assert.equal(quote.currency, "XOF");
});
test("operator switches are isolated by operation and country", async () => {
  const dependencies = fixtures();
  dependencies.operators[0].depositEnabled = false;
  await assert.rejects(() => calculateCustomerTransferQuote("fixture", deposit, dependencies), /non compatible/);
  await calculateCustomerTransferQuote("fixture", {
    kind: "inter-network", amountMinor: 10000, senderPaysFees: true,
    sourceOperatorId: "orange-ci", destinationOperatorId: "mtn-ci",
    senderPhone: "+2250700000000", recipientPhone: "+2250500000000",
  }, dependencies);
  await calculateCustomerTransferQuote("fixture", {
    ...deposit, sourceOperatorId: "mtn-cm", senderPhone: "+237600000000",
  }, dependencies);
});
test("country switch, phone rules, missing fee and cross-country inter-network fail closed", async () => {
  const dependencies = fixtures();
  dependencies.countries[0].depositEnabled = false;
  await assert.rejects(() => calculateCustomerTransferQuote("fixture", deposit, dependencies));
  await assert.rejects(() => calculateCustomerTransferQuote("fixture", {
    ...deposit, senderPhone: "+22507",
  }, fixtures()));
  const noFees = fixtures();
  noFees.rates = [];
  await assert.rejects(() => calculateCustomerTransferQuote("fixture", deposit, noFees), /frais/);
  await assert.rejects(() => calculateCustomerTransferQuote("fixture", {
    kind: "inter-network", amountMinor: 10000, senderPaysFees: true,
    sourceOperatorId: "orange-ci", destinationOperatorId: "mtn-cm",
    senderPhone: "+2250700000000", recipientPhone: "+237600000000",
  }, fixtures()), /non compatible/);
});
