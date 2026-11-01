import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSafeApiErrorCopy,
  shouldShowGlobalQueryError,
} from './safe-api-error.ts';

test('invalid sign-in details get a clear message without echoing server content', () => {
  const error = {
    status: 401,
    url: 'https://api.sendflow.example/api/auth/sign-in',
    data: { error: 'secret internals: account exists for private@example.com' },
    message: 'HTTP 401: secret internals',
  };

  assert.deepEqual(getSafeApiErrorCopy(error), {
    title: 'Connexion impossible',
    message: 'L’adresse e-mail ou le code secret est incorrect. Vérifiez vos informations. Si le problème persiste, contactez le service client SendFlow.',
  });
  assert.doesNotMatch(getSafeApiErrorCopy(error).message, /\b401\b|HTTP|secret internals|private@example\.com/);
});

test('blocked sign-in has its own safe user-facing message', () => {
  const error = {
    status: 423,
    url: 'https://api.sendflow.example/api/auth/sign-in',
    data: { error: 'internal suspension reason' },
  };

  assert.equal(getSafeApiErrorCopy(error).title, 'Compte bloqué');
  assert.match(getSafeApiErrorCopy(error).message, /service client SendFlow/);
  assert.doesNotMatch(getSafeApiErrorCopy(error).message, /423|HTTP|internal suspension reason/);
});

test('financial server failures advise checking status rather than repeating an operation', () => {
  const copy = getSafeApiErrorCopy({
    status: 503,
    url: 'https://api.sendflow.example/api/transfers',
    data: { error: 'database password leaked here' },
  });

  assert.match(copy.message, /Consultez son état/);
  assert.doesNotMatch(copy.message, /database password/);
  assert.match(copy.message, /service client SendFlow/);
  assert.doesNotMatch(copy.message, /\b503\b|HTTP/);
});

test('financial conflicts use the shared dialog while unrelated conflicts remain inline', () => {
  const financialError = {
    status: 409,
    url: 'https://api.sendflow.example/api/transfers/quote',
  };
  const ordinaryError = {
    status: 409,
    url: 'https://api.sendflow.example/api/profile',
  };

  assert.equal(shouldShowGlobalQueryError(financialError), true);
  assert.equal(getSafeApiErrorCopy(financialError).title, 'Opération à vérifier');
  assert.match(getSafeApiErrorCopy(financialError).message, /montant et les limites/);
  assert.equal(shouldShowGlobalQueryError(ordinaryError), false);
});

test('transfer quote failures state that no transfer was started', () => {
  const error = {
    status: 503,
    url: 'https://api.sendflow.example/api/me/transfer-quote',
    data: { error: 'private provider failure' },
  };

  assert.equal(shouldShowGlobalQueryError(error), true);
  assert.equal(getSafeApiErrorCopy(error).title, 'Vérification indisponible');
  assert.match(getSafeApiErrorCopy(error).message, /Aucun transfert n’a été lancé/);
  assert.doesNotMatch(getSafeApiErrorCopy(error).message, /provider failure|503|HTTP/);
});

test('query dialogs do not fire for expected auth, validation, or missing-resource responses', () => {
  assert.equal(shouldShowGlobalQueryError({ status: 401 }), false);
  assert.equal(shouldShowGlobalQueryError({ status: 404 }), false);
  assert.equal(shouldShowGlobalQueryError({ status: 422 }), false);
  assert.equal(shouldShowGlobalQueryError({ status: 503 }), true);
  assert.equal(shouldShowGlobalQueryError(new TypeError('Failed to fetch')), true);
});
