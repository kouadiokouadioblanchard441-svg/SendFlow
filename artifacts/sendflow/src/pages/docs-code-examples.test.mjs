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

test('production URL notes do not expose internal payment-readiness switches', () => {
  assert.match(docsCopy, /apiAvailabilityTitle: 'Adresses de production'/);
  assert.match(docsCopy, /apiAvailabilityText: 'API SendFlow : https:\/\/merchent\.business\.sendflow\.africa\/api\./);
  assert.match(docsCopy, /apiAvailabilityText: '.*https:\/\/payin\.merchant\.command\.sendflow\.africa/);
  assert.match(docsCopy, /serviceAvailability: 'Adresses de production et suivi'/);
  assert.match(docsCopy, /serviceAvailabilityText: 'Base de l’API SendFlow : https:\/\/merchent\.business\.sendflow\.africa\/api\./);
  assert.match(docsCopy, /apiAvailabilityTitle: 'Production URLs'/);
  assert.match(docsCopy, /serviceAvailability: 'Production URLs and status checks'/);
  assert.doesNotMatch(docsCopy, /LINKFLOW_SETTLEMENT_PROOF_READY/);
  assert.doesNotMatch(docsCopy, /apiAvailabilityText: '[^']*HTTP 503/);
  assert.doesNotMatch(docsCopy, /serviceAvailabilityText: '[^']*HTTP 503/);
});

test('documentation rendering does not depend on live payment-limit API data', () => {
  assert.doesNotMatch(docsCopy, /usePaymentLimits|paymentLimitsQuery/);
});

test('getting-started guide presents the production quickstart with SendFlow examples', () => {
  const startPageStart = docsCopy.indexOf("{pageKey === 'start' && <>");
  const authPageStart = docsCopy.indexOf("{pageKey === 'auth' && <>", startPageStart);
  assert.ok(startPageStart >= 0 && authPageStart > startPageStart);
  const startPage = docsCopy.slice(startPageStart, authPageStart);
  const quickstartSections = [
    't.whatIs',
    't.methods',
    'href="/docs/integrations/hosted"',
    'href="/docs/integrations/direct"',
    't.capabilitiesTitle',
    'SENDFLOW_API_BASE_URL=https://merchent.business.sendflow.africa/api',
    'SENDFLOW_CHECKOUT_ORIGIN=https://payin.merchant.command.sendflow.africa',
    't.threeSteps',
    't.quickstartTitle',
    't.quickstartPrereqTitle',
    'example="pricing"',
    'example="payment-limits"',
    'example="create-direct"',
    'example="read-public-session"',
    'example="start-attempt"',
    'example="read-session"',
  ].map((section) => startPage.indexOf(section));

  assert.ok(quickstartSections.every((position) => position >= 0));
  assert.deepEqual(quickstartSections, [...quickstartSections].sort((a, b) => a - b));
  assert.match(docsCopy, /startWelcomeTitle: 'Bienvenue sur SendFlow'/);
  assert.match(docsCopy, /startWelcomeTitle: 'Welcome to SendFlow'/);
  assert.match(docsCopy, /quickstartTitle: 'Démarrage rapide'/);
  assert.match(docsCopy, /quickstartTitle: 'Quickstart'/);
  assert.doesNotMatch(startPage, /ashtechpay|ASHTECH_API_KEY|\/v1\/collect/i);

  for (const example of ['pricing', 'payment-limits', 'create-direct', 'read-public-session', 'start-attempt', 'read-session']) {
    const formats = getDocsCodeFormats(example);
    for (const format of ['Node.js', 'Python', 'cURL', 'PHP']) {
      assert.ok(formats.includes(format), `${example} must include ${format}`);
    }
  }
  assert.match(getDocsCodeExample('pricing', 'Node.js'), /\/pricing/);
  assert.match(getDocsCodeExample('pricing', 'Node.js'), /operator\.fees/);
  assert.doesNotMatch(getDocsCodeExample('pricing', 'Node.js'), /\/fees|\/countries/);
  assert.match(getDocsCodeExample('payment-limits', 'Node.js'), /\/payment-limits/);
  assert.match(getDocsCodeExample('create-direct', 'Node.js'), /\/v1\/payment-sessions/);
  assert.match(getDocsCodeExample('read-public-session', 'Node.js'), /\/v1\/public\/payment-sessions/);
  assert.match(getDocsCodeExample('start-attempt', 'Node.js'), /\/attempts/);
  assert.match(getDocsCodeExample('read-session', 'Node.js'), /\/v1\/payment-sessions\//);
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

  const navStart = docsCopy.indexOf('const docsItems');
  const navEnd = docsCopy.indexOf('const docGroups', navStart);
  const navItems = docsCopy.slice(navStart, navEnd);
  for (const anchor of ['create-session', 'read-session', 'direct-choices', 'create-attempt', 'read-attempt', 'pricing-catalog', 'payment-limits']) {
    assert.doesNotMatch(navItems, new RegExp(`section:\\s*'${anchor}'`), `${anchor} should not take a separate menu entry`);
  }
  assert.doesNotMatch(navItems, /apiReference/);
});

test('sidebar keeps one entry per guide instead of listing every subsection', () => {
  const navStart = docsCopy.indexOf('const docsItems');
  const navEnd = docsCopy.indexOf('const docGroups', navStart);
  const navItems = docsCopy.slice(navStart, navEnd);

  assert.doesNotMatch(navItems, /section:/);
  assert.match(navItems, /path: '\/docs\/webhooks', key: 'webhooks'/);
  assert.match(navItems, /path: '\/docs\/reference', key: 'reference'/);
});

test('direct and hosted examples follow their documented integration steps', () => {
  const directStart = docsCopy.indexOf("{pageKey === 'direct' && <>");
  const hostedStart = docsCopy.indexOf("{pageKey === 'hosted' && <>", directStart);
  const webhooksStart = docsCopy.indexOf("{pageKey === 'webhooks' && <>", hostedStart);
  assert.ok(directStart >= 0 && hostedStart > directStart && webhooksStart > hostedStart);

  const directPage = docsCopy.slice(directStart, hostedStart);
  const directExamples = [
    'example="create-direct"',
    'example="read-public-session"',
    'example="start-attempt"',
    'example="poll-attempt"',
  ].map((example) => directPage.indexOf(example));
  assert.ok(directExamples.every((position) => position >= 0));
  assert.deepEqual(directExamples, [...directExamples].sort((a, b) => a - b));

  const hostedPage = docsCopy.slice(hostedStart, webhooksStart);
  const hostedExamples = [
    'example="create-hosted"',
    'example="read-session"',
  ].map((example) => hostedPage.indexOf(example));
  assert.ok(hostedExamples.every((position) => position >= 0));
  assert.deepEqual(hostedExamples, [...hostedExamples].sort((a, b) => a - b));
});

test('the direct API page includes the full endpoint reference below its integration steps', () => {
  const directStart = docsCopy.indexOf("{pageKey === 'direct' && <>");
  const hostedStart = docsCopy.indexOf("{pageKey === 'hosted' && <>", directStart);
  const directPage = docsCopy.slice(directStart, hostedStart);
  const referenceRendererStart = docsCopy.indexOf('const renderApiReference = () =>');
  const referenceRendererEnd = docsCopy.indexOf('\n    return (\n      <>', referenceRendererStart);
  const referenceRenderer = docsCopy.slice(referenceRendererStart, referenceRendererEnd);

  assert.match(directPage, /\{renderApiReference\(\)\}/);
  assert.match(referenceRenderer, /apiEndpointGroups\.map/);
  assert.match(referenceRenderer, /endpoint\.method/);
  assert.match(referenceRenderer, /endpoint\.path/);
  assert.match(docsCopy, /path: '\/api\/v1\/public\/payment-sessions\/\{sessionId\}\/attempts'/);
});

test('the former API reference URL now resolves to the single direct API guide', async () => {
  assert.match(docsCopy, /if \(path === '\/docs\/api-reference'\) setLocation\('\/docs\/integrations\/direct', \{ replace: true \}\)/);
  assert.match(await readFile(new URL('../lib/documentation-host.ts', import.meta.url), 'utf8'), /'\/docs\/api-reference': 'direct'/);
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
