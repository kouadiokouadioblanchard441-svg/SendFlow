import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLinkFlowShareTargets, getLinkFlowShareOrigin } from './linkflow-share.ts';

test('uses the configured SendFlow payment domain for production links', () => {
  const targets = buildLinkFlowShareTargets({
    origin: getLinkFlowShareOrigin('https://merchent.business.sendflow.africa', true),
    basePath: '/',
    sharePath: '/pay/abc_DEF-123',
    title: 'Paiement facture',
  });

  assert.equal(targets.url, 'https://payin.merchant.command.sendflow.africa/pay/abc_DEF-123');
});

test('keeps development links on the current preview origin', () => {
  assert.equal(
    getLinkFlowShareOrigin('https://preview.example.test/path', false),
    'https://preview.example.test',
  );
});

test('builds the public link beneath the configured artifact base path', () => {
  const targets = buildLinkFlowShareTargets({
    origin: 'https://app.example.test',
    basePath: '/sendflow/',
    sharePath: '/pay/abc_DEF-123',
    title: 'Paiement facture',
  });

  assert.equal(targets.url, 'https://app.example.test/sendflow/pay/abc_DEF-123');
});

test('keeps the shared payment link on the current origin', () => {
  assert.throws(() => buildLinkFlowShareTargets({
    origin: 'https://app.example.test',
    basePath: '/',
    sharePath: '//attacker.example/pay/abc',
    title: 'Paiement',
  }), /Invalid payment-link path/);
});

test('creates correctly encoded WhatsApp, Telegram and Facebook share targets', () => {
  const targets = buildLinkFlowShareTargets({
    origin: 'https://app.example.test',
    basePath: '/',
    sharePath: '/pay/abc_DEF-123',
    title: 'Été & facture',
  });

  assert.match(targets.whatsappUrl, /^https:\/\/wa\.me\/\?text=/);
  assert.match(targets.telegramUrl, /^https:\/\/t\.me\/share\/url\?/);
  assert.match(targets.facebookUrl, /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?/);
  assert.ok(targets.whatsappUrl.includes(encodeURIComponent('Été & facture')));
  assert.ok(targets.telegramUrl.includes('url=https%3A%2F%2Fapp.example.test%2Fpay%2Fabc_DEF-123'));
  assert.ok(targets.facebookUrl.includes('u=https%3A%2F%2Fapp.example.test%2Fpay%2Fabc_DEF-123'));
});
