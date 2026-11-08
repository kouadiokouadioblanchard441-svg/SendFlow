import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PAYMENT_LIMITS,
  getMinimumForTransfer,
  isValidPaymentLimitValues,
} from "./payment-limits-policy.ts";

test("defaults preserve configured FCFA thresholds and established ceilings", () => {
  assert.deepEqual(DEFAULT_PAYMENT_LIMITS, {
    minimumDepositMinor: 200,
    minimumPayoutMinor: 200,
    maximumPayoutDailyMinor: null,
    minimumInterNetworkMinor: 1,
    maximumTransferMinor: 10_000_000,
    maximumPayinMinor: 2_000_000,
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
});

test("each customer operation selects its own configured minimum", () => {
  assert.equal(getMinimumForTransfer("deposit", DEFAULT_PAYMENT_LIMITS), 200);
  assert.equal(getMinimumForTransfer("international", DEFAULT_PAYMENT_LIMITS), 200);
  assert.equal(getMinimumForTransfer("inter-network", DEFAULT_PAYMENT_LIMITS), 1);
});
