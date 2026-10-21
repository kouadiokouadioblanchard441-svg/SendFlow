import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { publicClientDefinitions } from './public-client-env.mjs';

test('only exact public URL names are embedded; secrets and extra VITE names are not', () => {
  const sensitive = randomUUID();
  const result = publicClientDefinitions({
    VITE_API_URL: '/api',
    VITE_PUBLIC_SITE_URL: 'https://example.invalid',
    DIDIT_API_KEY: sensitive,
    VITE_ESMS_API_KEY: sensitive,
    VITE_API_URL_SECRET: sensitive,
    VITE_UNKNOWN: sensitive,
  });
  assert.deepEqual(Object.keys(result).sort(), [
    'import.meta.env.VITE_API_BASE_URL',
    'import.meta.env.VITE_API_URL',
    'import.meta.env.VITE_PUBLIC_SITE_URL',
  ]);
  assert.equal(JSON.stringify(result).includes(sensitive), false);
  assert.equal(result['import.meta.env.VITE_API_URL'], '"/api"');
});

test('empty public values preserve same-origin defaults', () => {
  assert.equal(publicClientDefinitions({})['import.meta.env.VITE_API_URL'], '""');
});

test('URLs cannot smuggle credentials or query tokens; errors never echo input', () => {
  const sensitive = randomUUID();
  const authenticated = new URL('https://example.invalid');
  authenticated.username = 'user';
  authenticated.password = sensitive;
  for (const value of [
    authenticated.toString(),
    `https://example.invalid?token=${sensitive}`,
    `https://example.invalid#${sensitive}`,
    '//example.invalid', 'javascript:alert(1)', 'not-a-url', '/\\example.invalid',
  ]) {
    assert.throws(
      () => publicClientDefinitions({ VITE_API_URL: value }),
      error => !error.message.includes(sensitive) && error.message.includes('VITE_API_URL'),
    );
  }
  assert.throws(() => publicClientDefinitions({ VITE_PUBLIC_SITE_URL: '/relative' }));
});
