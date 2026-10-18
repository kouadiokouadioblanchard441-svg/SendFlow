import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresCustomerPinUnlock, shouldRelockCustomerPinUnlock } from './customer-route-guard.ts';

const adminRoutePath = '/admin-control-test';

test('customer routes still require customer PIN unlock', () => {
  assert.equal(requiresCustomerPinUnlock('/account'), true);
  assert.equal(requiresCustomerPinUnlock('/transaction/test-id'), true);
  assert.equal(requiresCustomerPinUnlock('/notifications/test-id'), true);
});

test('public customer login and admin routes do not require customer PIN unlock', () => {
  assert.equal(requiresCustomerPinUnlock('/sign-in'), false);
  assert.equal(requiresCustomerPinUnlock('/sign-up'), false);
  assert.equal(requiresCustomerPinUnlock(adminRoutePath), false);
  assert.equal(requiresCustomerPinUnlock(`${adminRoutePath}/sign-in`), false);
  assert.equal(requiresCustomerPinUnlock(`${adminRoutePath}/users`), false);
});

test('remote customer session lock or authorization failure clears the local PIN unlock', () => {
  assert.equal(shouldRelockCustomerPinUnlock(false, undefined), true);
  assert.equal(shouldRelockCustomerPinUnlock(undefined, 401), true);
  assert.equal(shouldRelockCustomerPinUnlock(undefined, 503), true);
  assert.equal(shouldRelockCustomerPinUnlock(true, undefined), false);
  assert.equal(shouldRelockCustomerPinUnlock(undefined, undefined), false);
});
