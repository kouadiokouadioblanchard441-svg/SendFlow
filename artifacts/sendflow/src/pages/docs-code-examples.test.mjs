import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getDocsCodeExample, getDocsCodeFormats } from './docs-code-examples.ts';

const apiBase = 'https://merchent.business.sendflow.africa/api';
const docsCopy = await readFile(new URL('./docs.tsx', import.meta.url), 'utf8');
const productionUrlSource = await readFile(new URL('./docs-production-urls.ts', import.meta.url), 'utf8');
const docsStyles = await readFile(new URL('./docs.css', import.meta.url), 'utf8');
const payoutRoutes = await readFile(
  new URL('../../../api-server/src/routes/developer-payouts.ts', import.meta.url),
  'utf8',
);
const generatedApiSchemas = await readFile(
  new URL('../../../../lib/api-zod/src/generated/api.ts', import.meta.url),
  'utf8',
);

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
  assert.match(nodeExample, /https:\/\/merchent\.business\.sendflow\.africa\/api/);
  assert.match(nodeExample, /https:\/\/payin\.merchant\.command\.sendflow\.africa/);
});

test('public documentation lists production URL settings and domains', () => {
  for (const host of [
    'https://merchent.business.sendflow.africa/api',
    'https://payin.merchant.command.sendflow.africa',
    'https://merchent.business.sendflow.africa',
    'https://sendflow.africa',
    'https://apis.docs.sendflow.africa',
  ]) {
    assert.ok(productionUrlSource.includes(host), `Missing production URL: ${host}`);
  }
  assert.match(docsCopy, /apiBaseUrlLabel: 'API SendFlow · SENDFLOW_API_BASE_URL'/);
  assert.match(docsCopy, /checkoutOriginLabel: 'Paiement hébergé · SENDFLOW_CHECKOUT_ORIGIN'/);
  assert.match(docsCopy, /data-testid="button-copy-url"/);
  assert.doesNotMatch(docsCopy, /illustratif|illustrative/i);
});

test('every API request example uses the centralized production API base', () => {
  const examples = [
    'create-hosted',
    'create-direct',
    'read-session',
    'read-public-session',
    'start-attempt',
    'poll-attempt',
    'handle-http-errors',
    'pricing',
    'payment-limits',
    'payout-quote',
    'payout-create',
    'payout-list',
    'payout-read',
    'payout-cancel',
  ];

  for (const example of examples) {
    for (const format of getDocsCodeFormats(example)) {
      const code = getDocsCodeExample(example, format);
      assert.ok(code.includes(apiBase), `${example} / ${format} must include the production API URL`);
      if (example === 'create-hosted') {
        assert.ok(
          code.includes('https://payin.merchant.command.sendflow.africa'),
          `${format} hosted checkout example must include the production checkout origin`,
        );
      }
    }
  }
});

test('production URL notes do not expose internal payment-readiness switches', () => {
  assert.match(docsCopy, /apiAvailabilityTitle: 'URL de production et statut des opérations'/);
  assert.match(docsCopy, /apiAvailabilityText: 'Toutes les requêtes utilisent l’adresse API de production du bloc copiable/);
  assert.match(docsCopy, /apiAvailabilityTitle: 'Production API URL and operation status'/);
  assert.match(docsCopy, /apiAvailabilityText: 'All requests use the production API address in the copyable/);
  assert.match(docsCopy, /serviceAvailability: 'Adresses de production et suivi'/);
  assert.match(docsCopy, /serviceAvailabilityText: 'Consultez le statut ou le webhook signé uniquement/);
  assert.match(docsCopy, /serviceAvailability: 'Production URLs and status checks'/);
  assert.match(docsCopy, /serviceAvailabilityText: 'Read the status or signed webhook only/);
  assert.doesNotMatch(docsCopy, /LINKFLOW_SETTLEMENT_PROOF_READY/);
  assert.match(docsCopy, /apiAvailabilityText:.*HTTP 503/);
  assert.match(docsCopy, /aucun fonds n’est réservé/);
  assert.match(docsCopy, /no funds are reserved/);
  assert.match(docsCopy, /apiScopeTitle: 'Sens des flux et disponibilité réelle'/);
  assert.match(docsCopy, /apiScopeTitle: 'Flow direction and actual availability'/);
  assert.match(docsCopy, /PAYIN : le client paie par Mobile Money/);
  assert.match(docsCopy, /PAYIN: the customer pays by Mobile Money/);
  assert.match(docsCopy, /PAYOUT : le marchand demande un transfert sortant/);
  assert.match(docsCopy, /PAYOUT: the merchant requests an outgoing transfer/);
});

test('production addresses appear before the status note on payment guides', () => {
  const startPageStart = docsCopy.indexOf("{pageKey === 'start' && <>");
  const directPageStart = docsCopy.indexOf("{pageKey === 'direct' && <>");
  const hostedPageStart = docsCopy.indexOf("{pageKey === 'hosted' && <>");
  const startUrlBlock = docsCopy.indexOf('value={productionUrls.apiBaseUrl}', startPageStart);
  const startStatus = docsCopy.indexOf('t.apiAvailabilityTitle', startPageStart);
  const directUrlBlock = docsCopy.indexOf('value={productionUrls.apiBaseUrl}', directPageStart);
  const directStatus = docsCopy.indexOf('t.apiAvailabilityTitle', directPageStart);
  const hostedUrlBlock = docsCopy.indexOf('value={productionUrls.apiBaseUrl}', hostedPageStart);
  const hostedStatus = docsCopy.indexOf('t.apiAvailabilityTitle', hostedPageStart);

  assert.ok(startPageStart >= 0 && startUrlBlock > startPageStart && startUrlBlock < startStatus);
  assert.ok(directPageStart >= 0 && directUrlBlock > directPageStart && directUrlBlock < directStatus);
  assert.ok(hostedPageStart >= 0 && hostedUrlBlock > hostedPageStart && hostedUrlBlock < hostedStatus);
});

test('documentation rendering does not depend on live payment-limit API data', () => {
  assert.doesNotMatch(docsCopy, /usePaymentLimits|paymentLimitsQuery/);
});

test('code examples have no repeated generic footer and retain one production integration note', () => {
  const codePanelStart = docsCopy.indexOf('function CodePanel');
  const docsPageStart = docsCopy.indexOf('export default function DocsPage()', codePanelStart);
  const codePanel = docsCopy.slice(codePanelStart, docsPageStart);

  assert.ok(codePanelStart >= 0 && docsPageStart > codePanelStart);
  assert.doesNotMatch(codePanel, /sf-docs-code-note|formatNote|codeNote/);
  assert.match(docsCopy, /quickstartIntegrationNote: 'Les adresses de production sont copiables/);
  assert.match(docsCopy, /quickstartIntegrationNote: 'Production addresses can be copied/);
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
    'value={productionUrls.apiBaseUrl}',
    'value={productionUrls.checkoutOrigin}',
    't.threeSteps',
    't.quickstartTitle',
    't.quickstartPrereqTitle',
    't.apiAvailabilityTitle',
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
  for (const format of ['JavaScript', 'Node.js', 'PHP', 'Python']) {
    const example = getDocsCodeExample('pricing', format);
    assert.match(example, /requiresOtp/, `${format} must read the operator OTP policy`);
    assert.match(example, /otpCommand/, `${format} must read the operator instruction`);
    assert.match(example, /operatorId/, `${format} must identify the operator`);
    const countryLookup = {
      JavaScript: /catalog\.countries\.find/,
      'Node.js': /catalog\.countries\.find/,
      PHP: /array_column\(\$catalog\["countries"\]/,
      Python: /country\["name"\].*country\["id"\]/s,
    }[format];
    assert.match(example, countryLookup, `${format} must resolve the country name dynamically`);
  }
  assert.match(docsCopy, /GET \/pricing renvoie le catalogue des pays et opérateurs avec requiresOtp et otpCommand/);
  assert.match(docsCopy, /otpCommand, s’il est présent, est un code ou une consigne à composer, pas l’OTP personnel du payeur/);
  assert.match(docsCopy, /GET \/pricing returns the country and operator catalog, including requiresOtp and otpCommand/);
  assert.match(docsCopy, /otpCommand is an instruction or code to dial, not the payer’s personal OTP/);
  assert.doesNotMatch(docsCopy, /#144\*82#/i, 'The documentation must not hard-code an operator dialing code');
  assert.match(getDocsCodeExample('payment-limits', 'Node.js'), /\/payment-limits/);
  assert.match(getDocsCodeExample('create-direct', 'Node.js'), /\/v1\/payment-sessions/);
  assert.match(getDocsCodeExample('read-public-session', 'Node.js'), /\/v1\/public\/payment-sessions/);
  assert.match(getDocsCodeExample('start-attempt', 'Node.js'), /\/attempts/);
  assert.match(getDocsCodeExample('read-session', 'Node.js'), /\/v1\/payment-sessions\//);
});

test('home introduction places the copyable production API base before integration choices', () => {
  const homeStart = docsCopy.indexOf('const renderHome = () => (');
  const apiUrlBlock = docsCopy.indexOf(
    '<CopyableUrlBlock language={language} label={t.apiBaseUrlLabel} value={productionUrls.apiBaseUrl} />',
    homeStart,
  );
  const methodsSection = docsCopy.indexOf('<section className="sf-docs-section sf-docs-home-methods">', homeStart);

  assert.ok(homeStart >= 0 && apiUrlBlock > homeStart && methodsSection > apiUrlBlock);
  assert.match(productionUrlSource, /apiBaseUrl: 'https:\/\/merchent\.business\.sendflow\.africa\/api'/);
});

test('production addresses are individually copyable and wrap on mobile', () => {
  assert.match(docsCopy, /function CopyableUrlBlock/);
  assert.match(docsCopy, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(docsCopy, /data-testid="button-copy-url"/);
  for (const urlKey of ['apiBaseUrl', 'checkoutOrigin', 'merchantApp', 'publicSite', 'documentation']) {
    assert.match(docsCopy, new RegExp(`value=\\{productionUrls\\.${urlKey}\\}`));
  }
  assert.match(docsStyles, /\.sf-docs-url-block \.sf-docs-url-value \{[^}]*overflow-wrap: anywhere/);
  assert.match(docsStyles, /\.sf-docs-url-block \.sf-docs-url-value \{[^}]*white-space: pre-wrap/);
  assert.match(docsStyles, /\.sf-docs-url-block \.sf-docs-url-value \{[^}]*font-size: 11px/);

  const translationsStart = docsCopy.indexOf('const localized:');
  const translationsEnd = docsCopy.indexOf('const localizedLists', translationsStart);
  assert.ok(translationsStart >= 0 && translationsEnd > translationsStart);
  assert.doesNotMatch(docsCopy.slice(translationsStart, translationsEnd), /https?:\/\/|merchent\.business|payin\.merchant|sendflow\.africa|apis\.docs/i);
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
    'example="pricing"',
    'example="payment-limits"',
    'example="create-direct"',
    'example="read-public-session"',
    'example="start-attempt"',
    'example="poll-attempt"',
    'example="read-session"',
    'example="webhook"',
    'example="handle-http-errors"',
  ].map((example) => directPage.indexOf(example));
  assert.ok(directExamples.every((position) => position >= 0));
  assert.deepEqual(directExamples, [...directExamples].sort((a, b) => a - b));
  assert.match(directPage, /t\.directPrerequisitesTitle/);
  assert.match(directPage, /localizedLists\[language\]\.credentialRows/);
  assert.match(directPage, /t\.directWebhookSetupTitle/);
  assert.match(directPage, /t\.directReliabilityTitle/);
  assert.match(docsCopy, /directCatalogText: '.*otpCommand.*ne codez pas de consigne par pays/);
  assert.match(docsCopy, /directCatalogText: '.*otpCommand.*do not hard-code country instructions/);
  for (const example of ['pricing', 'payment-limits', 'create-direct', 'read-public-session', 'start-attempt', 'poll-attempt', 'read-session', 'webhook', 'handle-http-errors']) {
    for (const format of ['Node.js', 'Python', 'cURL', 'PHP']) {
      assert.ok(getDocsCodeFormats(example).includes(format), `${example} must include ${format}`);
    }
  }

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

test('Mobile Money guidance describes operator USSD confirmation in both languages', () => {
  assert.match(docsCopy, /l’opérateur adresse au payeur une demande de confirmation USSD qu’il valide sur son téléphone/);
  assert.match(docsCopy, /operator sends the payer a USSD confirmation request to approve on their phone/);
  assert.match(docsCopy, /operator\.otpCommand ou null/);
  assert.match(docsCopy, /operator\.otpCommand or null/);
  assert.match(docsCopy, /si ussdCode est présent/);
  assert.match(docsCopy, /if ussdCode is present/);
  assert.doesNotMatch(docsCopy, /n’envoyez jamais de code OTP ou de PIN|never send an OTP or PIN/i);
});

test('Mobile Money guide distinguishes catalog metadata from supported attempt fields', () => {
  assert.match(docsCopy, /session peut aussi renvoyer otpCommand, une consigne de composition configurée côté serveur/);
  assert.match(docsCopy, /otpCommand ou null/);
  assert.match(docsCopy, /OTP reçu par SMS/);
  assert.match(docsCopy, /OTP obtenu après un code USSD/);
  assert.match(docsCopy, /Wave et ouverture d’application/);
  assert.match(docsCopy, /la réponse de tentative ne fournit pas de lien pour ouvrir l’application/);
  assert.match(docsCopy, /payment-link session may also return otpCommand, a server-configured dialing instruction/);
  assert.match(docsCopy, /SMS OTP/);
  assert.match(docsCopy, /OTP after dialing a USSD code/);
  assert.match(docsCopy, /Wave app handoff/);
  assert.match(docsCopy, /the attempt response does not provide a link to open the app/);
  assert.doesNotMatch(docsCopy, /wave_url|otp_required/i);
});

test('LinkFlow shows only the server instruction for an available selected operator', async () => {
  const paymentPage = await readFile(new URL('./public-payment-link.tsx', import.meta.url), 'utf8');
  assert.match(paymentPage, /\(link\.paymentAvailable \|\| previewSimulationAvailable\) && operator\?\.otpCommand/);
  assert.match(paymentPage, /data-testid="public-pay-otp-instruction"/);
  assert.match(paymentPage, /<strong>\{operator\.otpCommand\}<\/strong>/);
  assert.doesNotMatch(paymentPage, /otp:\s*operator\.otpCommand|setOtp/);
});

test('attempt examples keep operator confirmation outside the merchant API request', () => {
  for (const format of getDocsCodeFormats('start-attempt')) {
    const example = getDocsCodeExample('start-attempt', format);
    assert.doesNotMatch(example, /["'](?:otp|pin)["']\s*:/i, `${format} must not add operator confirmation fields`);
    assert.match(example, /ussdCode/i, `${format} must use only the USSD instruction returned by SendFlow`);
  }
  const requestSchemaStart = generatedApiSchemas.indexOf('export const StartDeveloperDirectPaymentBody =');
  const requestSchemaEnd = generatedApiSchemas.indexOf('export const StartDeveloperDirectPaymentResponse =', requestSchemaStart);
  const requestSchema = generatedApiSchemas.slice(requestSchemaStart, requestSchemaEnd);
  assert.ok(requestSchemaStart >= 0 && requestSchemaEnd > requestSchemaStart);
  for (const field of ['firstName', 'lastName', 'countryCode', 'operatorId', 'phoneNumber']) {
    assert.match(requestSchema, new RegExp(`"${field}"`));
  }
  assert.doesNotMatch(requestSchema, /"(?:otp|pin)"/i);
  assert.match(generatedApiSchemas.slice(requestSchemaEnd, requestSchemaEnd + 500), /"ussdCode": zod\.string\(\)\.nullable\(\)/);
  assert.match(docsCopy, /operator\.otpCommand ou null/);
  assert.match(docsCopy, /operator\.otpCommand or null/);
  assert.doesNotMatch(docsCopy, /#144\*82#/i, 'Unverified operator menu text must not be published as an OTP');
});

test('production integration practices cover correlation, confirmation, delivery, and retries', () => {
  for (const guidance of [
    'merchantReference unique',
    'même clé avec le même corps',
    'sessionId, attemptId et merchantReference',
    'HMAC sur le corps brut',
    'sendflow-delivery',
    'Respectez Retry-After',
    'personal data out of merchantReference and metadata',
    'Persist sessionId, attemptId, and merchantReference',
    'Verify webhook HMAC using the raw body and timestamp',
    'Respect Retry-After after 429',
  ]) {
    assert.ok(docsCopy.includes(guidance), `missing production integration guidance: ${guidance}`);
  }
});

test('merchant payout examples cover every implemented API route and keep creation fail-closed', () => {
  const payoutExamples = [
    ['payout-quote', '/v1/payout-quote'],
    ['payout-create', '/v1/payouts'],
    ['payout-list', '/v1/payouts'],
    ['payout-read', '/v1/payouts/'],
    ['payout-cancel', '/v1/payouts/'],
  ];
  const payoutSectionStart = docsCopy.indexOf('<h2>{t.payoutApiTitle}</h2>');
  assert.ok(payoutSectionStart >= 0);
  const payoutSection = docsCopy.slice(payoutSectionStart);

  for (const [example, route] of payoutExamples) {
    assert.ok(payoutSection.includes(`example="${example}"`), `${example} must appear in the payout guide`);
    for (const format of ['Node.js', 'Python', 'cURL', 'PHP']) {
      const code = getDocsCodeExample(example, format);
      assert.ok(code.includes(route), `${example} ${format} must call ${route}`);
    }
  }

  const createExamples = ['Node.js', 'Python', 'cURL', 'PHP'].map((format) =>
    getDocsCodeExample('payout-create', format),
  );
  for (const code of createExamples) {
    assert.match(code, /Idempotency-Key/);
    assert.match(code, /PAYOUT_BENEFICIARY_PHONE_E164/);
    assert.match(code, /feePayer/);
    assert.doesNotMatch(code, /feexpay|ashtechpay/i);
  }
  const payoutWebhookStart = docsCopy.indexOf('label={`${t.responseExample} · payout.created`}');
  assert.ok(payoutWebhookStart >= 0, 'the webhook guide must show the payout event payload');
  const payoutWebhookExample = docsCopy.slice(payoutWebhookStart, docsCopy.indexOf('</section>', payoutWebhookStart));
  for (const field of [
    '"amountMinor": 12500',
    '"beneficiaryAmountMinor": 12500',
    '"feePayer": "merchant"',
    '"status": "funds_reserved"',
    '"totalDebitMinor": 12750',
  ]) {
    assert.ok(payoutWebhookExample.includes(field), `payout webhook payload must include ${field}`);
  }
  assert.doesNotMatch(payoutWebhookExample, /beneficiaryPhone|phoneNumber/);
  for (const category of ['deposit', 'inter-network', 'international', 'linkflow', 'payout']) {
    assert.ok(docsCopy.includes(`"id": "${category}"`), `the public pricing example must include ${category}`);
  }
  assert.match(payoutRoutes, /router\.post\("\/v1\/payout-quote"/);
  assert.match(payoutRoutes, /router\.post\("\/v1\/payouts"/);
  assert.match(payoutRoutes, /router\.get\("\/v1\/payouts"/);
  assert.match(payoutRoutes, /router\.get\("\/v1\/payouts\/:payoutId"/);
  assert.match(payoutRoutes, /router\.post\("\/v1\/payouts\/:payoutId\/cancel"/);
  assert.match(payoutRoutes, /if \(!PAYOUT_EXECUTION_ENABLED\)/);
  assert.match(docsCopy, /HTTP 503 avec payout_unavailable : aucune demande n’est créée et aucun fonds n’est réservé/);
  assert.match(docsCopy, /HTTP 503 with payout_unavailable: no request is created and no funds are reserved/);
});

test('authentication documentation matches the key lifecycle and credential split', () => {
  assert.match(docsCopy, /Une paire initiale est créée à l’inscription et incluse dans la réponse de création du compte/);
  assert.match(docsCopy, /An initial pair is created at signup and included in the account-creation response/);
  assert.match(docsCopy, /la liste des clés ne montre que son préfixe/);
  assert.match(docsCopy, /the key list shows only its prefix/);
  assert.match(docsCopy, /X-SendFlow-Public-Key/);
  assert.match(docsCopy, /X-SendFlow-Client-Token/);
  assert.match(docsCopy, /X-LinkFlow-Attempt-Token/);
  assert.match(docsCopy, /The secret key is for private server requests/);
  assert.match(docsCopy, /the public key is used only for direct checkout requests/);
  assert.doesNotMatch(docsCopy, /not created automatically when an account is opened|n’est pas créée automatiquement à l’ouverture du compte|secret key with create permission|clé secrète avec permission de création|Check account eligibility and permissions/i);
});

test('hosted sessions expose a configurable merchant return URL in every code format', () => {
  for (const format of ['Node.js', 'Python', 'cURL', 'PHP']) {
    const hosted = getDocsCodeExample('create-hosted', format);
    assert.match(hosted, /returnUrl/);
    assert.match(hosted, /https:\/\/shop\.example\.com\/payment\/return/);
    assert.doesNotMatch(getDocsCodeExample('create-direct', format), /returnUrl/);
  }

  assert.match(docsCopy, /returnUrlTitle: 'Configurer le retour après paiement'/);
  assert.match(docsCopy, /returnUrlTitle: 'Configure the post-payment return'/);
  assert.match(docsCopy, /Ce champ n’est pas SENDFLOW_CHECKOUT_ORIGIN/);
  assert.match(docsCopy, /This field is not SENDFLOW_CHECKOUT_ORIGIN/);
  assert.match(docsCopy, /après un échec, le checkout ne redirige pas vers returnUrl/i);
  assert.match(docsCopy, /after a confirmed failure, checkout does not redirect to returnUrl/i);
  assert.match(docsCopy, /<p><strong>{t\.returnUrlTitle}<\/strong><\/p>/);
});
