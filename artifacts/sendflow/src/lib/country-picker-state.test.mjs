import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCountryPickerStatus } from './country-picker-state.ts';

const ready = {
  catalogIsLoading: false,
  catalogIsError: false,
  registrationSettingsIsLoading: false,
  registrationSettingsIsError: false,
  defaultCountryUnavailable: false,
  countryCount: 2,
};

test('keeps the picker disabled without showing an empty-catalog error while requests load', () => {
  assert.deepEqual(resolveCountryPickerStatus({
    ...ready,
    catalogIsLoading: true,
    countryCount: 0,
  }), { isDisabled: true });
});

test('reports a failed registration-countries request as unavailable, not as no countries', () => {
  assert.deepEqual(resolveCountryPickerStatus({
    ...ready,
    catalogIsError: true,
    countryCount: 0,
  }), {
    errorMessage: 'La liste des pays est temporairement indisponible.',
    isDisabled: true,
  });
});

test('reports an empty catalog only after a successful response', () => {
  assert.deepEqual(resolveCountryPickerStatus({
    ...ready,
    countryCount: 0,
  }), {
    errorMessage: 'Aucun pays n’est disponible pour le moment.',
    isDisabled: true,
  });
});

test('enables a populated catalog after the server settings are available', () => {
  assert.deepEqual(resolveCountryPickerStatus(ready), { isDisabled: false });
});
