import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDocumentationPageKey,
  isSendFlowDocumentationHost,
  isSendFlowDocumentationPreviewRoute,
} from './documentation-host.ts';

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

test('allows documentation preview routes only on local preview hosts', () => {
  assert.equal(isSendFlowDocumentationPreviewRoute('localhost', '/docs/getting-started'), true);
  assert.equal(isSendFlowDocumentationPreviewRoute('localhost', '/docs'), true);
  assert.equal(isSendFlowDocumentationPreviewRoute('127.0.0.1:80', '/docs/getting-started/'), true);
  assert.equal(isSendFlowDocumentationPreviewRoute('preview.replit.dev', '/docs/getting-started'), true);
  assert.equal(isSendFlowDocumentationPreviewRoute('preview.replit.dev', '/docs/unknown'), false);
  assert.equal(isSendFlowDocumentationPreviewRoute('preview.replit.dev', '/'), false);
  assert.equal(isSendFlowDocumentationPreviewRoute('merchent.business.sendflow.africa', '/docs/getting-started'), false);
});
