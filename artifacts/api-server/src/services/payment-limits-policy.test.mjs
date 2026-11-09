import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PAYMENT_LIMITS,
  addUnverifiedIncomingAmount,
  getMinimumForTransfer,
  hasReachedUnverifiedIncomingLimit,
  isMonthlyIncomingAmountAllowed,
  isMonthlyIncomingLimitReached,
  isValidPaymentLimitValues,
  resolveMonthlyIncomingLimit,
} from "./payment-limits-policy.ts";

test("defaults preserve configured FCFA thresholds and established ceilings", () => {
  assert.deepEqual(DEFAULT_PAYMENT_LIMITS, {
    minimumDepositMinor: 200,
    minimumPayoutMinor: 200,
    maximumPayoutDailyMinor: null,
    minimumInterNetworkMinor: 1,
    maximumTransferMinor: 10_000_000,
    maximumPayinMinor: 2_000_000,
    maximumUnverifiedIncomingMinor: 20_000,
    maximumVerifiedIncomingMinor: 4_000_000,
  });
  assert.equal(isValidPaymentLimitValues(DEFAULT_PAYMENT_LIMITS), true);
});

test("thresholds must be whole, positive and stay within existing technical ceilings", () => {
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, minimumPayoutMinor: 0 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, minimumPayoutMinor: 1.5 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, maximumPayinMinor: 2_000_001 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, minimumPayoutMinor: 2_000_001 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, minimumDepositMinor: 2_000_001 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, maximumTransferMinor: 199 }), false);
  assert.equal(isValidPaymentLimitValues({
    ...DEFAULT_PAYMENT_LIMITS,
    minimumDepositMinor: 300,
    maximumPayinMinor: 250,
  }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, maximumUnverifiedIncomingMinor: -1 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, maximumUnverifiedIncomingMinor: 2_147_483_648 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, maximumVerifiedIncomingMinor: 2_147_483_648 }), false);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, maximumUnverifiedIncomingMinor: 0 }), true);
  assert.equal(isValidPaymentLimitValues({ ...DEFAULT_PAYMENT_LIMITS, maximumVerifiedIncomingMinor: 0 }), true);
});

test("each customer operation selects its own configured minimum", () => {
  assert.equal(getMinimumForTransfer("deposit", DEFAULT_PAYMENT_LIMITS), 200);
  assert.equal(getMinimumForTransfer("international", DEFAULT_PAYMENT_LIMITS), 200);
  assert.equal(getMinimumForTransfer("inter-network", DEFAULT_PAYMENT_LIMITS), 1);
});

test("monthly payment caps vary by identity tier and allow user overrides", () => {
  assert.equal(hasReachedUnverifiedIncomingLimit(19_999, 20_000), false);
  assert.equal(hasReachedUnverifiedIncomingLimit(20_000, 20_000), true);
  assert.equal(isMonthlyIncomingLimitReached(19_999, 20_000), false);
  assert.equal(isMonthlyIncomingLimitReached(20_000, 20_000), true);
  assert.equal(isMonthlyIncomingLimitReached(4_000_000, 4_000_000), true);
  assert.equal(isMonthlyIncomingLimitReached(0, 0), true);
  assert.equal(resolveMonthlyIncomingLimit(false, null, 20_000, 4_000_000), 20_000);
  assert.equal(resolveMonthlyIncomingLimit(true, null, 20_000, 4_000_000), 4_000_000);
  assert.equal(resolveMonthlyIncomingLimit(false, 75_000, 20_000, 4_000_000), 75_000);
  assert.equal(resolveMonthlyIncomingLimit(true, 75_000, 20_000, 4_000_000), 75_000);
});

test("incoming payment attempts cannot reach beyond the remaining monthly cap", () => {
  assert.equal(isMonthlyIncomingAmountAllowed(15_000, 5_000, 20_000), true);
  assert.equal(isMonthlyIncomingAmountAllowed(15_000, 5_001, 20_000), false);
  assert.equal(isMonthlyIncomingAmountAllowed(20_000, 1, 20_000), false);
  assert.equal(isMonthlyIncomingAmountAllowed(19_000, 0, 20_000), false);
  assert.equal(isMonthlyIncomingAmountAllowed(19_000, 1, 0), false);
});

test("only receipts credited before identity approval increase the unverified total", () => {
  assert.equal(addUnverifiedIncomingAmount(18_000, 2_000, false), 20_000);
  assert.equal(addUnverifiedIncomingAmount(18_000, 2_000, true), 18_000);
  assert.equal(addUnverifiedIncomingAmount(Number.MAX_SAFE_INTEGER - 1, 10, false), Number.MAX_SAFE_INTEGER);
});
