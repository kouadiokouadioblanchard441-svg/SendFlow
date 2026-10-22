import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { httpErrorHandler } from "./http-error-handler.ts";

function invoke(error, state = {}) {
  const logs = [], result = { headers: {}, ...state };
  const req = { log: { error: (fields, message) => logs.push({ fields, message }) } };
  const res = {
    ...state,
    setHeader(name, value) { result.headers[name] = value; },
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; },
    destroy() { result.destroyed = true; },
  };
  httpErrorHandler(error, req, res, () => { throw new Error("Default handler must not run"); });
  return { result, logs };
}
test("uncaught internal failures cannot leak raw messages, SQL details or stacks", () => {
  const sensitive = randomUUID();
  const { result, logs } = invoke(Object.assign(new Error(sensitive), {
    code: "23505", detail: sensitive, query: sensitive, body: sensitive, status: 401,
  }));
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: "Internal server error" });
  assert.equal(result.headers["Cache-Control"], "no-store, private");
  assert.equal(JSON.stringify({ result, logs }).includes(sensitive), false);
});
test("known body parsing failures expose only fixed messages and bounded HTTP statuses", () => {
  for (const [type, status] of [
    ["entity.parse.failed", 400], ["entity.too.large", 413],
    ["parameters.too.many", 413], ["charset.unsupported", 415],
  ]) {
    const sensitive = randomUUID();
    const { result, logs } = invoke(Object.assign(new Error(sensitive), { type, body: sensitive }));
    assert.equal(result.status, status);
    assert.equal(JSON.stringify({ result, logs }).includes(sensitive), false);
  }
  assert.equal(invoke({ type: "toString" }).result.status, 500);
  assert.equal(invoke(new URIError("fixture-private-path")).result.status, 400);
  assert.equal(invoke({ get type() { throw new Error("Not read"); } }).result.status, 500);
});
test("already-started responses are closed without invoking the unsafe default handler", () => {
  const { result } = invoke(new Error("fixture"), { headersSent: true });
  assert.equal(result.destroyed, true);
  assert.equal(result.body, undefined);
});
