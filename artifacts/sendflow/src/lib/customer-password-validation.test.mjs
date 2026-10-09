import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_CUSTOMER_PASSWORD_MIN_LENGTH,
  NEW_CUSTOMER_PASSWORD_MIN_LENGTH,
  validateCustomerPassword,
} from './customer-password-validation.ts';

test('new customer passwords need eight characters while legacy sign-in can still accept four', () => {
  assert.equal(NEW_CUSTOMER_PASSWORD_MIN_LENGTH, 8);
  assert.match(validateCustomerPassword('Ab12cd') ?? '', /au moins 8 caractères/);
  assert.equal(validateCustomerPassword('Ab12cd34'), undefined);
  assert.equal(
    validateCustomerPassword('Ab12', LEGACY_CUSTOMER_PASSWORD_MIN_LENGTH),
    undefined,
  );
  assert.match(validateCustomerPassword('x'.repeat(65)) ?? '', /ne peut pas dépasser 64/);
});
