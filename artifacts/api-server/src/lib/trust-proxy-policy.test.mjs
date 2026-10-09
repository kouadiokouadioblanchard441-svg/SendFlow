import assert from "node:assert/strict";
import test from "node:test";
import { parseTrustProxyHops } from "./trust-proxy-policy.ts";

test("proxy trust uses one hop by default and accepts an explicit count", () => {
  assert.equal(parseTrustProxyHops(undefined), 1);
  assert.equal(parseTrustProxyHops("0"), 0);
  assert.equal(parseTrustProxyHops("2"), 2);
});

test("proxy trust rejects ambiguous or excessive configuration", () => {
  for (const value of ["-1", "1.5", "true", "17", "1,2"]) {
    assert.throws(() => parseTrustProxyHops(value), /TRUST_PROXY_HOPS/);
  }
});
