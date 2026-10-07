import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  encodeCustomerTransactionCursor,
  parseCustomerTransactionCursor,
} from './customer-transaction-cursor.ts';

const transactionId = '123e4567-e89b-42d3-a456-426614174000';

test('transaction cursors use a validated record UUID', () => {
  const token = encodeCustomerTransactionCursor(transactionId);
  const parsed = parseCustomerTransactionCursor(token);

  assert.equal(parsed.valid, true);
  if (parsed.valid) {
    assert.equal(parsed.cursor, transactionId);
  }
});

test('missing cursor starts at the newest transaction', () => {
  assert.deepEqual(parseCustomerTransactionCursor(undefined), {
    valid: true,
    cursor: null,
  });
});

test('malformed, non-canonical, and oversized cursors are rejected', () => {
  assert.equal(parseCustomerTransactionCursor(123).valid, false);
  assert.equal(parseCustomerTransactionCursor('not-a-cursor').valid, false);
  assert.equal(parseCustomerTransactionCursor('not-a-uuid').valid, false);
  assert.equal(parseCustomerTransactionCursor('x'.repeat(65)).valid, false);
});
