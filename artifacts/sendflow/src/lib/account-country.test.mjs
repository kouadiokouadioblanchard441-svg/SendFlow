import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredDefaultAccountCountry } from './account-country.ts';

test('resolves the default from the server-provided country code', () => {
  const countries = [
    {
      countryCode: 'ci',
      countryName: 'Côte d’Ivoire',
      phonePrefix: '+225',
      flag: '🇨🇮',
    },
    {
      countryCode: 'sn',
      countryName: 'Sénégal',
      phonePrefix: '+221',
      flag: '🇸🇳',
    },
  ];

  assert.deepEqual(getConfiguredDefaultAccountCountry(countries, 'ci'), {
    countryCode: 'ci',
    name: 'Côte d’Ivoire',
    dialCode: '+225',
    flag: '🇨🇮',
  });
});

test('does not invent a country when the configured default is absent', () => {
  assert.equal(getConfiguredDefaultAccountCountry([], 'ci'), undefined);
});
