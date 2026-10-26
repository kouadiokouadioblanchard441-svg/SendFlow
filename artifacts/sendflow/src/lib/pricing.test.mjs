import assert from 'node:assert/strict';
import test from 'node:test';
import { getVisiblePricingCountries } from './pricing.ts';

const country = (id, enabled, deposit) => ({
  id,
  name: id,
  dialCode: '+225',
  initials: id.toUpperCase(),
  flag: '',
  enabled,
  minPhoneDigits: 8,
  maxPhoneDigits: 10,
  operations: { deposit, interNetwork: true, international: true },
});

test('LinkFlow hides disabled countries and countries without deposit enabled', () => {
  const countries = [
    country('ci', true, true),
    country('sn', false, true),
    country('bf', true, false),
  ];
  assert.deepEqual(
    getVisiblePricingCountries(countries, 'linkflow').map((item) => item.id),
    ['ci'],
  );
});

test('other pricing categories retain their existing country list', () => {
  const countries = [country('ci', true, true), country('sn', false, true)];
  assert.deepEqual(getVisiblePricingCountries(countries, 'deposit'), countries);
});
