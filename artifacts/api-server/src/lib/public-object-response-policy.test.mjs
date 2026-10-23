import assert from "node:assert/strict";
import test from "node:test";
import { setPublicObjectResponseHeaders, validatePublicObjectUrl } from "./public-object-response-policy.ts";

test("public storage accepts only HTTPS Google Storage origins without redirects or credentials", () => {
  for (const value of ["https://storage.googleapis.com/bucket/key?signature=fixture",
    "https://fixture.storage.googleapis.com/key"]) {
    assert.equal(validatePublicObjectUrl(value), value);
  }
  for (const value of ["http://storage.googleapis.com/key", "https://storage.googleapis.com.evil.invalid/key",
    "https://127.0.0.1/key", "https://storage.googleapis.com:8443/key",
    "https://user@storage.googleapis.com/key", "https://storage.googleapis.com/key#fragment"]) {
    assert.throws(() => validatePublicObjectUrl(value));
  }
});

test("upstream object metadata cannot replace security headers or set application cookies", () => {
  for (const type of ["text/html", "image/svg+xml", "image/png", "application/javascript"]) {
    const headers = {};
    setPublicObjectResponseHeaders({ setHeader: (key, value) => { headers[key.toLowerCase()] = value; } },
      new Headers({ "Content-Type": type, "Content-Length": "99", "Set-Cookie": "unsafe=fixture",
        "X-Content-Type-Options": "unsafe", "Content-Security-Policy": "script-src *",
        "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=31536000" }));
    assert.equal(headers["set-cookie"], undefined);
    assert.equal(headers["content-length"], undefined);
    assert.equal(headers["access-control-allow-origin"], undefined);
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.match(headers["content-security-policy"], /^sandbox;/);
    assert.equal(headers["content-disposition"], type.startsWith("image/") ? "inline" : "attachment");
    assert.equal(headers["cache-control"], "public, max-age=300");
  }
});
