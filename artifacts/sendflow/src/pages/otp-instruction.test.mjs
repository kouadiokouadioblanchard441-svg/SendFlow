import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(new URL('./public-payment-link.tsx', import.meta.url), 'utf8');
const adminSource = await readFile(new URL('./admin.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../index.css', import.meta.url), 'utf8');

test('payer page displays only the selected operator instruction from the server', () => {
  assert.match(pageSource, /\(link\.paymentAvailable \|\| previewSimulationAvailable\) && operator\?\.otpCommand/);
  assert.match(pageSource, /data-testid="public-pay-otp-instruction"/);
  assert.match(pageSource, /<strong>\{operator\.otpCommand\}<\/strong>/);
  assert.match(pageSource, /Pour générer votre code OTP, composez cette instruction/);
  assert.match(styles, /\.sendflow-pay-otp-instruction\s*\{/);
});

test('admin manages each operator instruction without collecting the payer OTP', () => {
  assert.match(adminSource, /data-testid="input-otp-policy-command"/);
  assert.match(adminSource, /otpCommand: otpCommand \|\| null/);
  assert.match(adminSource, /expectedVersion: editing\.version/);
  assert.match(adminSource, /data-testid="input-otp-policy-reason"/);
  assert.match(adminSource, /pas l’OTP personnel ni une confirmation de paiement/);
  assert.match(adminSource, /\{amount\}/);
});
