import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderCountriesWithDefaultFirst } from './country-picker-order.ts';

test('puts the configured default country first and alphabetizes the rest', () => {
  const countries = [
    { countryCode: 'sn', name: 'Sénégal' },
    { countryCode: 'bf', name: 'Burkina Faso' },
    { countryCode: 'ci', name: 'Côte d’Ivoire' },
  ];

  assert.deepEqual(
    orderCountriesWithDefaultFirst(countries, 'CI').map((country) => country.countryCode),
    ['ci', 'bf', 'sn'],
  );
});

test('keeps every catalog country when no default entry is present', () => {
  const countries = [
    { countryCode: 'sn', name: 'Sénégal' },
    { countryCode: 'bf', name: 'Burkina Faso' },
  ];

  assert.deepEqual(
    orderCountriesWithDefaultFirst(countries, 'ci').map((country) => country.countryCode),
    ['bf', 'sn'],
  );
});
