import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocsCodeExample } from './docs-code-examples.ts';

const apiBase = 'https://merchent.business.sendflow.africa/api';

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
