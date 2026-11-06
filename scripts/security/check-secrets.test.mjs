import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRepository, scanText } from './check-secrets.mjs';

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

test('static API examples can show server environment usage without masking credentials', () => {
  const file = 'artifacts/sendflow/src/pages/docs-code-examples.ts';
  assert.deepEqual(scanText(file, 'const secretKey = process.env.SENDFLOW_SECRET_KEY;'), []);
  const token = ['sk_', 'live_', 'A'.repeat(32)].join('');
  assert.ok(scanText(file, `const example = "${token}";`).some(f => f.rule === 'provider-key'));
});

test('private .env values cannot be committed; public routing metadata is allowed', () => {
  assert.ok(scanText('artifacts/api-server/.env', 'LOG_LEVEL=info').some(f => f.rule === 'tracked-private-environment'));
  assert.deepEqual(scanText('.env.capacitor', 'VITE_API_URL=https://example.invalid/api'), []);
  assert.deepEqual(
    scanText('.env.capacitor', 'VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA'),
    [],
  );
  assert.deepEqual(scanText('.env.example', 'SESSION_SECRET='), []);
});

test('only the Turnstile site key may cross the client boundary', () => {
  const marker = `synthetic-secret-${randomUUID()}`;
  const secretValue = scanText(
    'artifacts/sendflow/dist/public/assets/auth.js',
    `const TURNSTILE_SECRET_KEY="${marker}";`,
  );
  const secretAccess = scanText(
    'artifacts/sendflow/dist/public/assets/auth.js',
    'const key = import.meta.env.TURNSTILE_SECRET_KEY;',
  );
  const publicSiteKey = scanText(
    'artifacts/sendflow/dist/public/assets/auth.js',
    'const key = import.meta.env.VITE_TURNSTILE_SITE_KEY;',
  );
  assert.ok(secretValue.some(f => f.rule === 'literal-credential'));
  assert.ok(secretAccess.some(f => f.rule === 'server-secret-client-access'));
  assert.deepEqual(publicSiteKey, []);
  assert.equal(JSON.stringify([...secretValue, ...secretAccess]).includes(marker), false);
});

test('all discovered server credentials are rejected from client access and literals', () => {
  const marker = `synthetic-secret-${randomUUID()}`;
  const file = 'artifacts/sendflow/dist/public/assets/auth.js';
  const names = [
    'EMAIL_UNSUBSCRIBE_SECRET',
    'RESEND_WEBHOOK_SECRET',
    'SENDFLOW_SECRET_KEY',
    'SENDFLOW_VIEWER_PASSWORD',
    'SENDFLOW_PII_BACKFILL_DATABASE_URL',
    'FEEXPAY_SANDBOX_API_KEY',
    'FEEXPAY_SHOP_ID',
    'AWS_SECRET_ACCESS_KEY',
    'ANDROID_KEY_ALIAS',
    'DATABASE_CA_CERT',
  ];
  for (const name of names) {
    assert.ok(
      scanText(file, `const value = import.meta.env.${name};`)
        .some(f => f.rule === 'server-secret-client-access'),
      `${name} must remain server-only`,
    );
    if (name !== 'DATABASE_CA_CERT') {
      const result = scanText(file, `const value = ${name}="${marker}";`);
      assert.ok(result.some(f => f.rule === 'literal-credential'), `${name} literal must be rejected`);
      assert.equal(JSON.stringify(result).includes(marker), false);
    }
  }
});

test('server references and synthetic test fixtures are not production credentials', () => {
  assert.deepEqual(scanText('artifacts/api-server/src/example.ts', 'const apiKey = process.env.DIDIT_API_KEY;'), []);
  assert.deepEqual(scanText('artifacts/api-server/src/example.test.mjs', 'const apiKey = "synthetic-fixture";'), []);
  const token = ['sk_', 'live_', 'A'.repeat(32)].join('');
  assert.ok(scanText('example.test.mjs', `const x = "${token}"`).some(f => f.rule === 'provider-key'));
});

test('deployment checkout without .git is scanned without reading ignored outputs or environment files', () => {
  const root = mkdtempSync(join(tmpdir(), 'sendflow-secret-scan-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, 'node_modules/pkg'), { recursive: true });
    mkdirSync(join(root, 'dist/public'), { recursive: true });
    writeFileSync(join(root, 'src/example.ts'), 'const apiKey = "synthetic-secret-marker-123456";\n');
    writeFileSync(join(root, 'node_modules/pkg/ignored.js'), 'const apiKey = "synthetic-secret-marker-123456";\n');
    writeFileSync(join(root, 'dist/public/ignored.js'), 'const apiKey = "synthetic-secret-marker-123456";\n');
    writeFileSync(join(root, '.env'), 'SESSION_SECRET="synthetic-secret-marker-123456"\n');

    const result = checkRepository(root);
    assert.equal(result.source, 'filesystem');
    assert.deepEqual(result.findings.map(({ file, rule }) => ({ file, rule })), [
      { file: 'src/example.ts', rule: 'literal-credential' },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
