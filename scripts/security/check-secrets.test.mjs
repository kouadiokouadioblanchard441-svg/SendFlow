import assert from 'node:assert/strict';
import test from 'node:test';
import { scanText } from './check-secrets.mjs';

test('literal secrets, authenticated URLs and private key material are rejected', () => {
  const token = ['sk_', 'live_', 'A'.repeat(32)].join('');
  const cases = [
    [`export const apiKey = "${'A'.repeat(32)}";`, 'literal-credential'],
    [`const value = "${token}";`, 'provider-key'],
    [['-----BEGIN ', 'PRIVATE KEY-----'].join(''), 'private-key'],
    [['postgresql://', 'user', ':', 'password', '@db.invalid/db'].join(''), 'credential-url'],
    [['VITE_', 'ESMS_', 'API_KEY', '='].join(''), 'public-secret-variable'],
  ];
  for (const [text, rule] of cases) {
    assert.ok(scanText('artifacts/api-server/src/example.ts', text).some(f => f.rule === rule));
    assert.equal(JSON.stringify(scanText('example.ts', text)).includes(token), false);
  }
});

test('client code cannot import the database or access server environment variables', () => {
  const file = 'artifacts/sendflow/src/example.ts';
  assert.ok(scanText(file, 'const value = process.env.SESSION_SECRET').some(f => f.rule === 'client-server-boundary'));
  assert.ok(scanText(file, 'import { db } from "@workspace/db"').some(f => f.rule === 'client-server-boundary'));
  assert.deepEqual(scanText(file, 'const origin = import.meta.env.VITE_API_URL;'), []);
});

test('private .env values cannot be committed; public routing metadata is allowed', () => {
  assert.ok(scanText('artifacts/api-server/.env', 'LOG_LEVEL=info').some(f => f.rule === 'tracked-private-environment'));
  assert.deepEqual(scanText('.env.capacitor', 'VITE_API_URL=https://example.invalid/api'), []);
  assert.deepEqual(scanText('.env.example', 'SESSION_SECRET='), []);
});

test('server references and synthetic test fixtures are not production credentials', () => {
  assert.deepEqual(scanText('artifacts/api-server/src/example.ts', 'const apiKey = process.env.DIDIT_API_KEY;'), []);
  assert.deepEqual(scanText('artifacts/api-server/src/example.test.mjs', 'const apiKey = "synthetic-fixture";'), []);
  const token = ['sk_', 'live_', 'A'.repeat(32)].join('');
  assert.ok(scanText('example.test.mjs', `const x = "${token}"`).some(f => f.rule === 'provider-key'));
});
