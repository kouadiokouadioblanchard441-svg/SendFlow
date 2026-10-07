import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateTransferAmountBreakdown } from './transfer-amounts.ts';

test('sender-paid fees are added to the source debit', () => {
  assert.deepEqual(calculateTransferAmountBreakdown(10_000, 0.015, true), {
    feeAmount: 150,
    recipientAmount: 10_000,
    totalDebit: 10_150,
  });
});

test('recipient-paid fees are deducted from the amount received', () => {
  assert.deepEqual(calculateTransferAmountBreakdown(10_000, 0.015, false), {
    feeAmount: 150,
    recipientAmount: 9_850,
    totalDebit: 10_000,
  });
});

test('unknown fees produce no authoritative totals', () => {
  assert.deepEqual(calculateTransferAmountBreakdown(10_000, undefined, true), {
    feeAmount: null,
    recipientAmount: null,
    totalDebit: null,
  });
});

test('a confirmed zero-percent fee is distinct from an unknown fee', () => {
  assert.deepEqual(calculateTransferAmountBreakdown(10_000, 0, true), {
    feeAmount: 0,
    recipientAmount: 10_000,
    totalDebit: 10_000,
  });
});

test('a fee equal to the transfer amount cannot produce a negative recipient amount', () => {
  assert.deepEqual(calculateTransferAmountBreakdown(10_000, 1, false), {
    feeAmount: 10_000,
    recipientAmount: 0,
    totalDebit: 10_000,
  });
});

test('invalid amounts, rates, and overflowing totals fail explicitly', () => {
  assert.throws(() => calculateTransferAmountBreakdown(-1, 0.01, true), RangeError);
  assert.throws(() => calculateTransferAmountBreakdown(10, -0.01, true), RangeError);
  assert.throws(() => calculateTransferAmountBreakdown(10, Number.NaN, true), RangeError);
  assert.throws(() => calculateTransferAmountBreakdown(10, 1.01, true), RangeError);
  assert.throws(() => calculateTransferAmountBreakdown(Number.MAX_SAFE_INTEGER, 1, true), RangeError);
});
