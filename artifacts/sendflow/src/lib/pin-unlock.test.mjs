import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { clearPinUnlock, getPinUnlockExpiry, markPinUnlocked } from './pin-unlock.ts';

let stored;
beforeEach(() => {
  stored = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key),
    },
  };
});

test('an unlocked PIN expires before the server deadline', () => {
  markPinUnlocked(100_000);
  const expiry = getPinUnlockExpiry(100_000);
  assert.ok(expiry > 100_000);
  assert.ok(expiry < 100_000 + 15 * 60_000);
  assert.equal(getPinUnlockExpiry(expiry - 1), expiry);
  assert.equal(getPinUnlockExpiry(expiry), null);
  assert.equal(stored.size, 0);
});

test('legacy flags without an expiry fail closed', () => {
  stored.set('sendflow.pin.unlocked', 'true');
  assert.equal(getPinUnlockExpiry(100_000), null);
  assert.equal(stored.size, 0);
});

test('malformed and excessively long unlocks are rejected', () => {
  stored.set('sendflow.pin.unlocked', 'true');
  stored.set('sendflow.pin.unlocked-until', 'not-a-timestamp');
  assert.equal(getPinUnlockExpiry(100_000), null);
  markPinUnlocked(100_000);
  stored.set('sendflow.pin.unlocked-until', String(100_000 + 60 * 60_000));
  assert.equal(getPinUnlockExpiry(100_000), null);
  markPinUnlocked(100_000);
  clearPinUnlock();
  assert.equal(stored.size, 0);
});