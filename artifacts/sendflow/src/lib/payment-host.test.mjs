import assert from 'node:assert/strict';
import test from 'node:test';
import { isSendFlowPaymentHost, SENDFLOW_PAYMENT_ORIGIN } from './payment-host.ts';

test('matches only the configured payment hostname', () => {
  assert.equal(isSendFlowPaymentHost('payin.merchant.command.sendflow.africa'), true);
  assert.equal(isSendFlowPaymentHost('PAYIN.MERCHANT.COMMAND.SENDFLOW.AFRICA'), true);
  assert.equal(isSendFlowPaymentHost('merchent.business.sendflow.africa'), false);
  assert.equal(isSendFlowPaymentHost('payin.merchant.command.sendflow.africa.attacker.test'), false);
});

test('uses the exact HTTPS payment origin', () => {
  assert.equal(SENDFLOW_PAYMENT_ORIGIN, 'https://payin.merchant.command.sendflow.africa');
});
