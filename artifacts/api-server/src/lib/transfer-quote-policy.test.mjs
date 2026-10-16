import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateTransferQuoteAmounts } from "./transfer-quote-policy.ts";

test("sender-paid fees add the fee to the debit and preserve the received amount", () => {
  assert.deepEqual(calculateTransferQuoteAmounts(10_000, 1.5, true), {
    feeMinor: 150,
    recipientAmountMinor: 10_000,
    totalDebitMinor: 10_150,
  });
});

test("recipient-paid fees reduce the received amount without changing debit", () => {
  assert.deepEqual(calculateTransferQuoteAmounts(10_000, 1.5, false), {
    feeMinor: 150,
    recipientAmountMinor: 9_850,
    totalDebitMinor: 10_000,
  });
});

test("fee rounding is upward and safe near the integer range", () => {
  assert.equal(calculateTransferQuoteAmounts(1, 0.0001, true)?.feeMinor, 1);
  assert.equal(calculateTransferQuoteAmounts(Number.MAX_SAFE_INTEGER, 0, true)?.totalDebitMinor,
    Number.MAX_SAFE_INTEGER);
  assert.equal(calculateTransferQuoteAmounts(Number.MAX_SAFE_INTEGER, 0.0001, true), null);
});

test("zero recipient delivery and invalid rates or amounts are rejected", () => {
  assert.equal(calculateTransferQuoteAmounts(1, 100, false), null);
  assert.equal(calculateTransferQuoteAmounts(0, 1, true), null);
  assert.equal(calculateTransferQuoteAmounts(1, 100.01, true), null);
  assert.equal(calculateTransferQuoteAmounts(1, Number.NaN, true), null);
});
