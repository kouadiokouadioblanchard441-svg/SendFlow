import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getDocsCodeExample, getDocsCodeFormats } from './docs-code-examples.ts';

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

test('API endpoints are grouped by session, checkout, and public catalog flow', () => {
  const groupsStart = docsCopy.indexOf('const apiEndpointGroups');
  const groupsEnd = docsCopy.indexOf('const docSearchTerms', groupsStart);
  assert.ok(groupsStart >= 0 && groupsEnd > groupsStart);
  const groups = docsCopy.slice(groupsStart, groupsEnd);
  const groupKeys = [
    'endpointGroupSessions',
    'endpointGroupDirect',
    'endpointGroupCatalog',
  ].map((key) => groups.indexOf(key));

  assert.ok(groupKeys.every((position) => position >= 0));
  assert.deepEqual(groupKeys, [...groupKeys].sort((a, b) => a - b));
  assert.match(docsCopy, /endpointGroupSessions: '1\. Sessions serveur'/);
  assert.match(docsCopy, /endpointGroupSessions: '1\. Server sessions'/);
});

test('direct and hosted examples follow their documented integration steps', () => {
  const directStart = docsCopy.indexOf("{pageKey === 'direct' && <>");
  const hostedStart = docsCopy.indexOf("{pageKey === 'hosted' && <>", directStart);
  const apiStart = docsCopy.indexOf("{pageKey === 'api' && <>", hostedStart);
  assert.ok(directStart >= 0 && hostedStart > directStart && apiStart > hostedStart);

  const directPage = docsCopy.slice(directStart, hostedStart);
  const directExamples = [
    'example="create-direct"',
    'example="read-public-session"',
    'example="start-attempt"',
    'example="poll-attempt"',
  ].map((example) => directPage.indexOf(example));
  assert.ok(directExamples.every((position) => position >= 0));
  assert.deepEqual(directExamples, [...directExamples].sort((a, b) => a - b));

  const hostedPage = docsCopy.slice(hostedStart, apiStart);
  const hostedExamples = [
    'example="create-hosted"',
    'example="read-session"',
  ].map((example) => hostedPage.indexOf(example));
  assert.ok(hostedExamples.every((position) => position >= 0));
  assert.deepEqual(hostedExamples, [...hostedExamples].sort((a, b) => a - b));
});

test('public OTP guidance follows the merchant API contract', () => {
  assert.match(docsCopy, /L’API de paiement marchand n’accepte aucun champ OTP ou PIN/);
  assert.match(docsCopy, /The merchant payments API accepts no OTP or PIN fields/);
  assert.match(docsCopy, /attempt\.ussdCode ou null/);
  assert.match(docsCopy, /attempt\.ussdCode or null/);
});

test('attempt examples never send an OTP or PIN to the merchant API', () => {
  for (const format of getDocsCodeFormats('start-attempt')) {
    const example = getDocsCodeExample('start-attempt', format);
    assert.doesNotMatch(example, /["'](?:otp|pin)["']\s*:/i, `${format} must not send an OTP or PIN`);
    assert.match(example, /ussdCode/i, `${format} must use only the USSD instruction returned by SendFlow`);
  }
  assert.match(docsCopy, /attempt\.ussdCode ou null/);
  assert.match(docsCopy, /attempt\.ussdCode or null/);
  assert.doesNotMatch(docsCopy, /#144\*82#/i, 'Unverified operator menu text must not be published as an OTP');
});
