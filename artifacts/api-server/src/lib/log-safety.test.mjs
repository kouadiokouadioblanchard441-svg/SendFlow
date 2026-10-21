import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { safeErrorForLog, sensitiveLogPaths, errorLogSerializers } from './log-safety.ts';

test('raw database/provider error contents never enter logs', () => {
  const sensitive = randomUUID();
  const error = Object.assign(new Error(sensitive), {
    code: '23505', detail: sensitive, query: sensitive,
    params: [sensitive], providerMessage: sensitive, cause: new Error(sensitive),
  });
  assert.deepEqual(safeErrorForLog(error), { type: 'Error', errorCode: '23505' });
  let output = '';
  const logger = pino({
    redact: sensitiveLogPaths,
    serializers: errorLogSerializers,
  }, { write(chunk) { output += chunk; } });
  logger.error({
    err: error, error, apiKey: sensitive, phone: sensitive,
    providerMessage: sensitive, body: { password: sensitive },
    nested: { deep: { token: sensitive } },
    req: { headers: { authorization: sensitive, cookie: sensitive } },
    res: { headers: { 'set-cookie': sensitive } },
  }, 'Provider request failed');
  assert.equal(output.includes(sensitive), false);
  assert.equal(JSON.parse(output).err.errorCode, '23505');
  assert.equal(JSON.parse(output).msg, 'Provider request failed');
});

test('pino-http children preserve safe errors instead of default raw serialization', () => {
  const sensitive = randomUUID();
  let output = '';
  const logger = pino({
    redact: sensitiveLogPaths,
    serializers: errorLogSerializers,
  }, { write(chunk) { output += chunk; } });
  const middleware = pinoHttp({ logger, serializers: errorLogSerializers });
  middleware.logger.error({
    err: Object.assign(new Error(sensitive), { detail: sensitive, code: '23505' }),
  }, 'Database request failed');
  assert.equal(output.includes(sensitive), false);
  assert.equal(JSON.parse(output).err.errorCode, '23505');
});

test('untrusted codes, getters, strings and toJSON are not logged or invoked', () => {
  const sensitive = randomUUID();
  assert.deepEqual(safeErrorForLog({ code: sensitive }), { type: 'Error' });
  assert.deepEqual(safeErrorForLog(sensitive), { type: 'Error' });
  const tricky = {
    get code() { throw new Error('Getter must not be invoked'); },
    toJSON() { throw new Error('toJSON must not be invoked'); },
  };
  assert.deepEqual(safeErrorForLog(tricky), { type: 'Error' });
  assert.deepEqual(safeErrorForLog(new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error('Unavailable'); },
  })), { type: 'Error' });
});
