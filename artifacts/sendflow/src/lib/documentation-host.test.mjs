import test from 'node:test';
import assert from 'node:assert/strict';
import { isSendFlowDocumentationHost } from './documentation-host.ts';

test('matches only the configured public documentation hostname', () => {
  assert.equal(isSendFlowDocumentationHost('apis.docs.sendflow.africa'), true);
  assert.equal(isSendFlowDocumentationHost('APIS.DOCS.SENDFLOW.AFRICA'), true);
  assert.equal(isSendFlowDocumentationHost('merchent.business.sendflow.africa'), false);
  assert.equal(isSendFlowDocumentationHost('apis.docs.sendflow.africa.attacker.test'), false);
});
