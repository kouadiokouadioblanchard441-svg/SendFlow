import assert from "node:assert/strict";
import test from "node:test";
import { projectCustomerTransactionHistoryValues } from "./customer-transaction-history-policy.ts";

test("projects LinkFlow deposits as the net wallet credit and SendFlow destination", () => {
  assert.deepEqual(
    projectCustomerTransactionHistoryValues(
      { amountMinor: 2030, feeMinor: 30, toOperator: null },
      { attemptId: "link-payment", recipientTotalMinor: 2000 },
    ),
    { amountMinor: 2000, toOperator: "sendflow" },
  );
});

test("keeps non-LinkFlow transaction history values unchanged", () => {
  assert.deepEqual(
    projectCustomerTransactionHistoryValues(
      { amountMinor: 2000, feeMinor: 30, toOperator: "wave" },
      { attemptId: null, recipientTotalMinor: null },
    ),
    { amountMinor: 2000, toOperator: "wave" },
  );
});

test("fails closed when LinkFlow net, fee, and payer total do not reconcile", () => {
  assert.throws(
    () =>
      projectCustomerTransactionHistoryValues(
        { amountMinor: 2030, feeMinor: 30, toOperator: null },
        { attemptId: "link-payment", recipientTotalMinor: 1999 },
      ),
    /amounts are inconsistent/,
  );
});
