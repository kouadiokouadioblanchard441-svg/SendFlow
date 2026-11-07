import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getDocsCodeExample } from './docs-code-examples.ts';

const apiBase = 'https://merchent.business.sendflow.africa/api';
const docsCopy = await readFile(new URL('./docs.tsx', import.meta.url), 'utf8');

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

test('public documentation lists production URL settings and domains without Replit references', () => {
  assert.doesNotMatch(docsCopy, /replit/i);
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
