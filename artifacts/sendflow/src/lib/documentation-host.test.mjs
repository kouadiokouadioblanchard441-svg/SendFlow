import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocumentationPageKey, isSendFlowDocumentationHost } from './documentation-host.ts';

test('matches only the configured public documentation hostname', () => {
  assert.equal(isSendFlowDocumentationHost('apis.docs.sendflow.africa'), true);
  assert.equal(isSendFlowDocumentationHost('APIS.DOCS.SENDFLOW.AFRICA'), true);
  assert.equal(isSendFlowDocumentationHost('merchent.business.sendflow.africa'), false);
  assert.equal(isSendFlowDocumentationHost('apis.docs.sendflow.africa.attacker.test'), false);
});

test('resolves only existing documentation pages and accepts trailing slashes', () => {
  assert.equal(getDocumentationPageKey('/'), 'home');
  assert.equal(getDocumentationPageKey('/docs'), 'home');
  assert.equal(getDocumentationPageKey('/docs/integrations/hosted/'), 'hosted');
  assert.equal(getDocumentationPageKey('/docs/does-not-exist'), null);
});
