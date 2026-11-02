import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { publicClientDefinitions } from './public-client-env.mjs';

test('only allowlisted public values, including the Turnstile site key, are embedded', () => {
  const sensitive = randomUUID();
  const siteKey = '1x00000000000000000000AA';
  const result = publicClientDefinitions({
    VITE_API_URL: '/api',
    VITE_PUBLIC_SITE_URL: 'https://example.invalid',
    VITE_TURNSTILE_SITE_KEY: siteKey,
    TURNSTILE_SECRET_KEY: sensitive,
    DIDIT_API_KEY: sensitive,
    VITE_ESMS_API_KEY: sensitive,
    VITE_API_URL_SECRET: sensitive,
    VITE_UNKNOWN: sensitive,
  });
  assert.deepEqual(Object.keys(result).sort(), [
    'import.meta.env.VITE_API_BASE_URL',
    'import.meta.env.VITE_API_URL',
    'import.meta.env.VITE_PUBLIC_SITE_URL',
    'import.meta.env.VITE_TURNSTILE_SITE_KEY',
  ]);
  assert.equal(JSON.stringify(result).includes(sensitive), false);
  assert.equal(result['import.meta.env.VITE_API_URL'], '"/api"');
  assert.equal(result['import.meta.env.VITE_TURNSTILE_SITE_KEY'], JSON.stringify(siteKey));
});

test('empty public values preserve same-origin defaults', () => {
  assert.equal(publicClientDefinitions({})['import.meta.env.VITE_API_URL'], '""');
  assert.equal(publicClientDefinitions({})['import.meta.env.VITE_TURNSTILE_SITE_KEY'], '""');
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

test('Turnstile configuration accepts a public site key only, without echoing invalid input', () => {
  const sensitive = randomUUID();
  assert.throws(
    () => publicClientDefinitions({ VITE_TURNSTILE_SITE_KEY: `https://example.invalid/${sensitive}` }),
    (error) => error.message.includes('VITE_TURNSTILE_SITE_KEY') && !error.message.includes(sensitive),
  );
});
