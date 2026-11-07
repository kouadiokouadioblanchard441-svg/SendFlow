import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getDocsCodeExample, getDocsCodeFormats } from './docs-code-examples.ts';
import { feexpayChannels } from '../../../api-server/src/providers/feexpay/catalog.ts';

const apiBase = 'https://merchent.business.sendflow.africa/api';
const docsCopy = await readFile(new URL('./docs.tsx', import.meta.url), 'utf8');
const docsStyles = await readFile(new URL('./docs.css', import.meta.url), 'utf8');

test('long documentation URLs wrap inside callouts and code notes', () => {
  assert.match(docsStyles, /\.sf-docs-callout\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(docsStyles, /\.sf-docs-code-note\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(docsStyles, /\.sf-docs-base-url\s+span\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test('browser direct-payment examples use the production API base URL', () => {
  for (const example of ['read-public-session', 'start-attempt', 'poll-attempt']) {
    assert.match(getDocsCodeExample(example, 'JavaScript'), new RegExp(apiBase.replaceAll('.', '\\.')));
  }
});

test('hosted checkout examples keep the payment origin separate from the API base', () => {
  const nodeExample = getDocsCodeExample('create-hosted', 'Node.js');
  assert.match(nodeExample, /process\.env\.SENDFLOW_API_BASE_URL/);
  assert.match(nodeExample, /process\.env\.SENDFLOW_CHECKOUT_ORIGIN/);
  assert.doesNotMatch(nodeExample, /payin\.merchant\.command\.sendflow\.africa/);
});

test('public documentation lists production URL settings and domains', () => {
  assert.match(docsCopy, /SENDFLOW_API_BASE_URL=https:\/\/merchent\.business\.sendflow\.africa\/api/);
  assert.match(docsCopy, /SENDFLOW_CHECKOUT_ORIGIN=https:\/\/payin\.merchant\.command\.sendflow\.africa/);
  for (const host of [
    'https://merchent.business.sendflow.africa',
    'https://sendflow.africa',
    'https://apis.docs.sendflow.africa',
    'https://payin.merchant.command.sendflow.africa',
  ]) {
    assert.ok(docsCopy.includes(host), `Missing production URL: ${host}`);
  }
  assert.doesNotMatch(docsCopy, /illustratif|illustrative/i);
});

test('getting-started guide presents the production flow in executable steps', () => {
  const startPageStart = docsCopy.indexOf("{pageKey === 'start' && <>");
  const authPageStart = docsCopy.indexOf("{pageKey === 'auth' && <>", startPageStart);
  assert.ok(startPageStart >= 0 && authPageStart > startPageStart);
  const startPage = docsCopy.slice(startPageStart, authPageStart);
  const examplePanels = [
    'example="pricing"',
    'example="payment-limits"',
    'example="create-hosted"',
    'example="read-session"',
  ].map((panel) => startPage.indexOf(panel));

  assert.ok(examplePanels.every((position) => position >= 0));
  assert.deepEqual(examplePanels, [...examplePanels].sort((a, b) => a - b));
});

test('OTP-required merchant channels are all disclosed with their actual unsupported status', () => {
  const countryNames = {
    BJ: { fr: 'Bénin', en: 'Benin' },
    BF: { fr: 'Burkina Faso', en: 'Burkina Faso' },
    SN: { fr: 'Sénégal', en: 'Senegal' },
  };
  const requiredChannels = feexpayChannels.filter((channel) => channel.requiresOtp);
  assert.deepEqual(requiredChannels.map((channel) => channel.id), [
    'coris-bj',
    'orange-bf',
    'wave-bf',
    'orange-sn',
  ]);

  const frenchStart = docsCopy.indexOf('mobileMoneyCards: [');
  const frenchEnd = docsCopy.indexOf('troubleshooting:', frenchStart);
  const englishStart = docsCopy.indexOf('mobileMoneyCards: [', frenchEnd);
  const englishEnd = docsCopy.indexOf('troubleshooting:', englishStart);
  assert.ok(frenchStart >= 0 && frenchEnd > frenchStart && englishEnd > englishStart);
  const frenchCards = docsCopy.slice(frenchStart, frenchEnd);
  const englishCards = docsCopy.slice(englishStart, englishEnd);

  for (const channel of requiredChannels) {
    const labels = countryNames[channel.countryCode];
    assert.ok(labels, `Missing country labels for ${channel.countryCode}`);
    const frenchCard = frenchCards.split('\n').find((line) =>
      line.includes(`title: '${labels.fr} · ${channel.operator}`));
    const englishCard = englishCards.split('\n').find((line) =>
      line.includes(`title: '${labels.en} · ${channel.operator}`));
    assert.ok(frenchCard, `Missing French OTP card for ${channel.id}`);
    assert.ok(englishCard, `Missing English OTP card for ${channel.id}`);
    assert.match(frenchCard, /OTP requis · non pris en charge/);
    assert.match(englishCard, /OTP required · unsupported/);
  }
});

test('attempt examples never send an OTP or PIN to the merchant API', () => {
  for (const format of getDocsCodeFormats('start-attempt')) {
    const example = getDocsCodeExample('start-attempt', format);
    assert.doesNotMatch(example, /["'](?:otp|pin)["']\s*:/i, `${format} must not send an OTP or PIN`);
    assert.match(example, /ussdCode/i, `${format} must use only the USSD instruction returned by SendFlow`);
  }
  assert.match(docsCopy, /Réponse attempt\.ussdCode ou null/);
  assert.match(docsCopy, /attempt\.ussdCode or null/);
  assert.doesNotMatch(docsCopy, /#144\*82#/i, 'Unverified operator menu text must not be published as an OTP');
});
