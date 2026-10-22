import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  ACCOUNT_PROFILE_KEY,
  clearLegacyAccountProfile,
  splitFullName,
} from './account-profile.ts';

let stored;

beforeEach(() => {
  stored = new Map();
  globalThis.window = {
    localStorage: {
      get length() {
        return stored.size;
      },
      key: (index) => [...stored.keys()][index] ?? null,
      removeItem: (key) => stored.delete(key),
    },
  };
});

test('splits only the server-provided name and never invents missing profile fields', () => {
  assert.deepEqual(splitFullName('Aïcha Marie Koné'), {
    firstName: 'Aïcha',
    lastName: 'Marie Koné',
  });
  assert.deepEqual(splitFullName(''), { firstName: '', lastName: '' });
});

test('removes both old unscoped and account-scoped profile copies from browser storage', () => {
  stored.set(ACCOUNT_PROFILE_KEY, '{"firstName":"Fiction","birthDate":"2000-01-01"}');
  stored.set(`${ACCOUNT_PROFILE_KEY}:customer-1`, '{"firstName":"Old","birthDate":"1990-01-01"}');
  stored.set('sendflow.account.country', 'CI');
  stored.set('unrelated', 'keep');

  clearLegacyAccountProfile();

  assert.equal(stored.has(ACCOUNT_PROFILE_KEY), false);
  assert.equal(stored.has(`${ACCOUNT_PROFILE_KEY}:customer-1`), false);
  assert.equal(stored.get('sendflow.account.country'), 'CI');
  assert.equal(stored.get('unrelated'), 'keep');
});
