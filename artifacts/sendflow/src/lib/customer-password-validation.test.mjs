import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_CUSTOMER_PASSWORD_MIN_LENGTH,
  NEW_CUSTOMER_PASSWORD_MIN_LENGTH,
  validateCustomerPassword,
} from './customer-password-validation.ts';

test('new customer passwords need eight characters, a letter, and a digit', () => {
  assert.equal(NEW_CUSTOMER_PASSWORD_MIN_LENGTH, 8);
  assert.match(validateCustomerPassword('Ab12cd') ?? '', /au moins 8 caractères/);
  assert.equal(validateCustomerPassword('Ab12cd34'), undefined);
  assert.match(validateCustomerPassword('abcdefgh') ?? '', /au moins une lettre et un chiffre/);
  assert.match(validateCustomerPassword('12345678') ?? '', /au moins une lettre et un chiffre/);
});

test('legacy customer sign-in remains compatible with four-character passwords', () => {
  assert.equal(
    validateCustomerPassword('1234', LEGACY_CUSTOMER_PASSWORD_MIN_LENGTH),
    undefined,
  );
  assert.match(validateCustomerPassword('x'.repeat(65)) ?? '', /ne peut pas dépasser 64/);
});
