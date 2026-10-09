import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  ACCOUNT_PROFILE_KEY,
  readAccountProfile,
  saveAccountProfile,
} from './account-profile.ts';

const profileA = {
  lastName: 'Koné',
  firstName: 'Aïcha',
  birthDate: '1996-04-12',
};
const profileB = {
  lastName: 'Traoré',
  firstName: 'Moussa',
  birthDate: '1992-08-23',
};

let stored;

beforeEach(() => {
  stored = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key),
    },
  };
});

test('profiles are stored and read only under the matching customer ID', () => {
  saveAccountProfile(profileA, 'customer-a');
  saveAccountProfile(profileB, 'customer-b');

  assert.deepEqual(readAccountProfile('customer-a'), profileA);
  assert.deepEqual(readAccountProfile('customer-b'), profileB);
  assert.deepEqual(readAccountProfile('customer-c'), {
    lastName: 'A.',
    firstName: 'Mariam',
    birthDate: '2000-01-01',
  });
});

test('an unscoped legacy profile is discarded instead of assigned to a customer', () => {
  stored.set(ACCOUNT_PROFILE_KEY, JSON.stringify(profileA));

  assert.deepEqual(readAccountProfile('customer-b'), {
    lastName: 'A.',
    firstName: 'Mariam',
    birthDate: '2000-01-01',
  });
  assert.equal(stored.has(ACCOUNT_PROFILE_KEY), false);
});

test('saving requires a non-empty authenticated customer ID', () => {
  assert.throws(() => saveAccountProfile(profileA, ''), /customer account is required/i);
  assert.equal(stored.size, 0);
});
