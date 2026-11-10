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

test('URL labels use neutral wording and do not expose internal payment-readiness switches', () => {
  assert.match(docsCopy, /baseUrlTitle: 'Adresses'/);
  assert.match(docsCopy, /baseUrlTitle: 'Addresses'/);
  assert.match(docsCopy, /apiAvailabilityTitle: 'Adresse de l’API'/);
  assert.match(docsCopy, /apiAvailabilityText: 'Toutes les requêtes utilisent l’adresse indiquée dans le bloc copiable/);
  assert.match(docsCopy, /apiAvailabilityTitle: 'API address'/);
  assert.match(docsCopy, /apiAvailabilityText: 'All requests use the address shown in the copyable/);
  assert.match(docsCopy, /serviceAvailability: 'Adresses et suivi'/);
  assert.match(docsCopy, /serviceAvailabilityText: 'Consultez le statut ou le webhook signé uniquement/);
  assert.match(docsCopy, /serviceAvailability: 'Addresses and status checks'/);
  assert.match(docsCopy, /serviceAvailabilityText: 'Read the status or signed webhook only/);
  assert.match(docsCopy, /quickstartIntegrationNote: 'Copiez les adresses dans les blocs ci-dessus/);
  assert.match(docsCopy, /quickstartIntegrationNote: 'Copy the addresses from the blocks above/);
  assert.doesNotMatch(docsCopy, /(?:Adresses|Addresses|URL) de production|Production URLs|production API address/i);
  assert.doesNotMatch(docsCopy, /LINKFLOW_SETTLEMENT_PROOF_READY/);
  assert.match(docsCopy, /Cette page décrit le contrat de l’API ; elle ne mesure pas sa disponibilité en temps réel/);
  assert.match(docsCopy, /This page describes the API contract; it does not measure live availability/);
  assert.doesNotMatch(docsCopy, /Statut actuel:.*HTTP 503|Current status:.*HTTP 503/);
  assert.doesNotMatch(docsCopy, /Actuellement, la création répond HTTP 503|Creation currently returns HTTP 503/);
  assert.doesNotMatch(docsCopy, /La création reste fermée: HTTP 503|Creation is currently closed: HTTP 503/);
  assert.match(docsCopy, /apiScopeTitle: 'Flux PAYIN et PAYOUT'/);
  assert.match(docsCopy, /apiScopeTitle: 'PAYIN and PAYOUT flows'/);
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
  assert.match(docsCopy, /quickstartIntegrationNote: 'Copiez les adresses dans les blocs ci-dessus/);
  assert.match(docsCopy, /quickstartIntegrationNote: 'Copy the addresses from the blocks above/);
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
  assert.match(docsCopy, /#144\*82#/i, 'The reference matrix includes the supplied Côte d’Ivoire example');
  assert.match(docsCopy, /#144#391#|#144#77#|\*144\*4\*6\*montant#/i);
  assert.match(docsCopy, /Example command: display configured otpCommand|Exemple de commande : affichez la valeur otpCommand/i);
  assert.doesNotMatch(getDocsCodeExample('pricing', 'Node.js'), /#144|#144#391#|\*144\*4\*6/i);
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

test('sidebar separates hosted checkout and indexes payout documentation', () => {
  assert.match(docsCopy, /path: '\/docs\/integrations\/hosted', key: 'hosted', label: 'Hosted Checkout', group: 'hosted'/);
  assert.match(docsCopy, /id: 'hosted', labelKey: 'hostedGroup'/);
  assert.match(docsCopy, /id: 'integration', labelKey: 'integrationGroup'/);
  assert.match(docsCopy, /hostedGroup: 'Paiement hébergé'/);
  assert.match(docsCopy, /hostedGroup: 'Hosted Checkout'/);
  assert.match(docsCopy, /payout-quote payout-create payout-list payout-read payout-cancel retrait versement sortant/);
  assert.match(docsCopy, /payout\.created payout\.processing payout\.succeeded payout\.failed payout\.uncertain/);
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
  assert.match(docsCopy, /directCatalogText: '.*source de vérité des opérateurs disponibles.*requiresOtp et otpCommand/);
  assert.match(docsCopy, /directCatalogText: '.*source of truth for available operators.*requiresOtp and otpCommand/);
  for (const example of ['pricing', 'payment-limits', 'create-direct', 'read-public-session', 'start-attempt', 'submit-otp', 'confirm-otp', 'handle-flow-action', 'poll-attempt', 'read-session', 'webhook', 'handle-http-errors']) {
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

test('Mobile Money guidance documents OTP and redirect actions in both languages', () => {
  assert.match(docsCopy, /Après le démarrage, le payeur reçoit une demande USSD de son opérateur et la valide sur son téléphone/);
  assert.match(docsCopy, /operator sends the payer a USSD confirmation request to approve on their phone/);
  assert.match(docsCopy, /requiresOtp et otpCommand viennent de cette même réponse/);
  assert.match(docsCopy, /requiresOtp and otpCommand come from this same response/);
  assert.match(docsCopy, /flow\.action = "enter_otp"/);
  assert.match(docsCopy, /flow\.reference/);
  assert.match(docsCopy, /flow\.redirectUrl/);
  assert.doesNotMatch(docsCopy, /n’envoyez jamais de code OTP ou de PIN|never send an OTP or PIN/i);
});

test('Mobile Money guide exposes a provider-neutral attempt contract', () => {
  assert.match(docsCopy, /Confirmation sur téléphone \(USSD Push\).*HTTP 201 avec state waiting ou uncertain/);
  assert.match(docsCopy, /Phone confirmation \(USSD Push\).*HTTP 201 with state waiting or uncertain/);
  assert.match(docsCopy, /OTP obtenu avant la tentative/);
  assert.match(docsCopy, /Défi OTP par l’opérateur/);
  assert.match(docsCopy, /Wave et ouverture d’application/);
  assert.match(docsCopy, /Operator OTP challenge/);
  assert.match(docsCopy, /Wave app handoff/);
  assert.match(docsCopy, /flow\.action = open_redirect/);
  assert.match(docsCopy, /otp_required/);

  const sessionSchemaStart = generatedApiSchemas.indexOf('export const GetDeveloperPublicPaymentSessionResponse =');
  const sessionSchemaEnd = generatedApiSchemas.indexOf('export const StartDeveloperDirectPaymentParams =', sessionSchemaStart);
  const directSessionSchema = generatedApiSchemas.slice(sessionSchemaStart, sessionSchemaEnd);
  assert.ok(sessionSchemaStart >= 0 && sessionSchemaEnd > sessionSchemaStart);
  assert.match(directSessionSchema, /requiresOtp/);
  assert.match(directSessionSchema, /otpMethod/);
  assert.match(directSessionSchema, /otpCommand/);
});

test('Direct API OTP section includes country commands, OTP example, and Wave handoff', () => {
  assert.match(docsCopy, /mobileMoneyOtpTitle: 'Parcours OTP et codes USSD'/);
  assert.match(docsCopy, /mobileMoneyOtpTitle: 'OTP flows and USSD codes'/);
  for (const code of ['#144*82#', '#144#391#', '#144#77#', '*144*4*6*montant#']) {
    assert.ok(docsCopy.includes(code), `The reference matrix must include ${code}`);
  }
  assert.match(docsCopy, /Côte d’Ivoire · Wave/);
  assert.match(docsCopy, /Senegal · Wave/);
  assert.match(docsCopy, /flow\.redirectUrl/);
  assert.match(docsCopy, /directOtpRequiredResponse/);
  assert.match(docsCopy, /const directOtpChallengeResponse =/);
  assert.match(docsCopy, /"action": "enter_otp",\s+"reference": "9d8e1e40-bb2a-4d83-8e50-a5c1b8d28642"/);

  const otpSection = docsCopy.indexOf('<h3 id="direct-otp-guide">{t.mobileMoneyOtpTitle}</h3>');
  const countrySection = docsCopy.indexOf('<h3>{t.mobileMoneyCountryTitle}</h3>', otpSection);
  assert.ok(otpSection >= 0 && countrySection > otpSection);
  const otpSectionMarkup = docsCopy.slice(otpSection, countrySection);
  assert.match(otpSectionMarkup, /mobileMoneyOtpRows\.map/);
  assert.match(otpSectionMarkup, /example="pricing"/);
  assert.match(otpSectionMarkup, /example="start-attempt"/);
  assert.match(otpSectionMarkup, /example="submit-otp"/);
  assert.match(otpSectionMarkup, /example="confirm-otp"/);
  assert.match(otpSectionMarkup, /201 · flow\.action = enter_otp/);
  assert.match(otpSectionMarkup, /example="handle-flow-action"/);
});

test('LinkFlow shows only the server instruction for an available selected operator', async () => {
  const paymentPage = await readFile(new URL('./public-payment-link.tsx', import.meta.url), 'utf8');
  assert.match(paymentPage, /\(link\.paymentAvailable \|\| previewSimulationAvailable\) && operator\?\.otpCommand/);
  assert.match(paymentPage, /data-testid="public-pay-otp-instruction"/);
  assert.match(paymentPage, /<strong>\{operator\.otpCommand\}<\/strong>/);
  assert.doesNotMatch(paymentPage, /otp:\s*operator\.otpCommand|setOtp/);
});

test('basic attempt examples and OTP confirmation examples match the API schema', () => {
  for (const format of getDocsCodeFormats('start-attempt')) {
    const example = getDocsCodeExample('start-attempt', format);
    assert.match(example, /ussdCode/i, `${format} must use only the USSD instruction returned by SendFlow`);
  }
  for (const format of getDocsCodeFormats('confirm-otp')) {
    const example = getDocsCodeExample('confirm-otp', format);
    assert.match(example, /otp/i, `${format} must send the payer-provided OTP`);
    assert.match(example, /reference/i, `${format} must use the returned challenge reference`);
    assert.match(example, /payer-order-2026-0042/, `${format} must reuse the attempt idempotency key`);
  }
  for (const format of getDocsCodeFormats('submit-otp')) {
    const example = getDocsCodeExample('submit-otp', format);
    assert.match(example, /otp/i, `${format} must submit the previously obtained OTP`);
    assert.doesNotMatch(example, /["']reference["']\s*:/i, `${format} must not invent a challenge reference`);
  }
  const requestSchemaStart = generatedApiSchemas.indexOf('export const StartDeveloperDirectPaymentBody =');
  const requestSchemaEnd = generatedApiSchemas.indexOf('export const StartDeveloperDirectPaymentResponse =', requestSchemaStart);
  const requestSchema = generatedApiSchemas.slice(requestSchemaStart, requestSchemaEnd);
  assert.ok(requestSchemaStart >= 0 && requestSchemaEnd > requestSchemaStart);
  for (const field of ['firstName', 'lastName', 'countryCode', 'operatorId', 'phoneNumber']) {
    assert.match(requestSchema, new RegExp(`"${field}"`));
  }
  assert.match(requestSchema, /"otp"/);
  assert.match(requestSchema, /"reference"/);
  const responseSchema = generatedApiSchemas.slice(requestSchemaEnd, requestSchemaEnd + 1200);
  assert.match(responseSchema, /"flow"/);
  assert.match(responseSchema, /"ussdCode": zod\.string\(\)\.nullable\(\)/);
  assert.doesNotMatch(getDocsCodeExample('start-attempt', 'Node.js'), /#144|#144#391#|\*144\*4\*6/i,
    'Code samples must use the SendFlow-returned instruction, not hard-code a reference value');
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
  assert.match(payoutRoutes, /!isPayoutExecutionEnabled\(\)/);
  assert.match(payoutRoutes, /configuration\.routedAggregatorCode !== "feexpay"/);
  assert.match(docsCopy, /Un timeout ne prouve pas que la demande a échoué : reprenez avec la même clé ou vérifiez son état/);
  assert.match(docsCopy, /A timeout does not prove failure: retry with the same key or check the request status/);
  assert.match(docsCopy, /Un 503 indique que la route ou sa configuration de production n’est pas disponible/);
  assert.match(docsCopy, /A 503 means the route or its production configuration is unavailable/);
  assert.doesNotMatch(docsCopy, /currently returns 503 with payout_unavailable|currently closed: HTTP 503 payout_unavailable/i);
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
