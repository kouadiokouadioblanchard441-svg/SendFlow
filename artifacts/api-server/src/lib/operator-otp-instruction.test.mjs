import assert from 'node:assert/strict';
import test from 'node:test';
import { GetPublicPaymentLinkResponse, UpdateAdminOtpPolicyBody } from '../../../../lib/api-zod/src/generated/api.ts';
import { getConfiguredOtpCommand } from './operator-otp-instruction.ts';

test('only returns a server-configured dialing instruction for OTP-required operators', () => {
  assert.equal(getConfiguredOtpCommand(undefined), null);
  assert.equal(getConfiguredOtpCommand({ requiresOtp: false, otpCommand: '#123#' }), null);
  assert.equal(getConfiguredOtpCommand({ requiresOtp: true, otpCommand: null }), null);
  assert.equal(getConfiguredOtpCommand({ requiresOtp: true, otpCommand: '#123*4#' }), '#123*4#');
  const amountTemplate = { requiresOtp: true, otpCommand: '*144*4*6*{amount}#' };
  assert.equal(getConfiguredOtpCommand(amountTemplate), '*144*4*6*{amount}#');
  assert.equal(getConfiguredOtpCommand(amountTemplate, 12500), '*144*4*6*12500#');
  assert.equal(getConfiguredOtpCommand(amountTemplate, 0), null);
});

test('admin OTP policy accepts dial codes and rejects text that is not dialable', () => {
  const base = { requiresOtp: true, expectedVersion: 0, reason: 'Configuration opérateur' };
  assert.equal(UpdateAdminOtpPolicyBody.safeParse({ ...base, otpCommand: '#123*4#' }).success, true);
  assert.equal(UpdateAdminOtpPolicyBody.safeParse({ ...base, otpCommand: '*144*4*6*{amount}#' }).success, true);
  assert.equal(UpdateAdminOtpPolicyBody.safeParse({ ...base, otpCommand: null }).success, true);
  assert.equal(UpdateAdminOtpPolicyBody.safeParse({ ...base, otpCommand: '#123# option 2' }).success, false);
  assert.equal(UpdateAdminOtpPolicyBody.safeParse({ ...base, otpCommand: 'javascript:alert(1)' }).success, false);
});

test('public payment-link schema carries the selected operator instruction only', () => {
  const response = {
    state: 'active',
    merchantName: 'Marchand de test',
    description: '',
    currency: 'XOF',
    currencyDecimals: 0,
    amountMinor: 5000,
    expiresAt: null,
    remainingUses: null,
    imagePath: null,
    paymentAvailable: false,
    simulationAvailable: false,
    countries: [{
      code: 'ci',
      name: 'Côte d’Ivoire',
      flag: '🇨🇮',
      phonePrefix: '+225',
      minPhoneDigits: 8,
      maxPhoneDigits: 12,
      operators: [{
        id: 'orange-ci',
        name: 'Réseau',
        initials: 'R',
        logoUrl: null,
        otpCommand: '#123*4#',
      }],
    }],
  };
  assert.equal(GetPublicPaymentLinkResponse.safeParse(response).success, true);
  assert.equal(GetPublicPaymentLinkResponse.safeParse({
    ...response,
    countries: [{
      ...response.countries[0],
      operators: [{ ...response.countries[0].operators[0], otpCommand: 'not-a-dial-code' }],
    }],
  }).success, false);
});
