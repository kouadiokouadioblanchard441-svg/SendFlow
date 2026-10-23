import assert from "node:assert/strict";
import test from "node:test";
import { apiRequestSecurity } from "./api-request-security.ts";

const guard = apiRequestSecurity(new Set(["https://sendflow-test.invalid"]));

function invoke(method, path, origin) {
  const result = { status: null, next: false, headers: {} };
  const req = { method, path, get: () => origin };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(value) { result.status = value; return this; },
    json() { return this; },
  };
  guard(req, res, () => { result.next = true; });
  return result;
}

test("every unsafe API method rejects missing, opaque, malformed and foreign origins", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "TRACE"]) {
    for (const origin of [undefined, "null", "sendflow-test.invalid", "//sendflow-test.invalid",
      "https://sendflow-test.invalid.evil.invalid", "https://sendflow-test.invalid/path"]) {
      const result = invoke(method, "/me/profile", origin);
      assert.equal(result.status, 403, `${method} ${origin}`);
      assert.equal(result.next, false);
      assert.equal(result.headers["Cache-Control"], "no-store, private");
    }
  }
});

test("safe API reads and allowed browser mutations preserve the handler", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(invoke(method, "/me", undefined).next, true);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(invoke(method, "/me/profile", "https://sendflow-test.invalid").next, true);
  }
});

test("only the exact signed Didit POST can bypass the browser-origin guard", () => {
  assert.equal(invoke("POST", "/webhooks/didit", undefined).next, true);
  for (const path of ["/webhooks/didit/", "/webhooks/didit/extra", "/webhooks/feexpay",
    "/webhooks/didit%2f", "/WEBHOOKS/DIDIT"]) {
    assert.equal(invoke("POST", path, undefined).status, 403, path);
  }
  assert.equal(invoke("PUT", "/webhooks/didit", undefined).status, 403);
});
