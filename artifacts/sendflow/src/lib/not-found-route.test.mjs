import assert from 'node:assert/strict';
import test from 'node:test';
import { getNotFoundHomeHref } from './not-found-route.ts';

test('keeps the recovery link on the documentation domain', () => {
  assert.equal(getNotFoundHomeHref('apis.docs.sendflow.africa'), '/docs');
});

test('sends invalid payment-domain paths to the public SendFlow site', () => {
  assert.equal(getNotFoundHomeHref('payin.merchant.command.sendflow.africa'), 'https://sendflow.africa');
});

test('keeps application recovery on its current domain', () => {
  assert.equal(getNotFoundHomeHref('merchent.business.sendflow.africa'), '/');
});
