import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllowedOrigins,
  getTrustedHost,
  isAllowedRequestOrigin,
  normalizeHttpOrigin,
} from "./origin-policy.ts";

test("origin configuration is canonicalized without accepting URL paths", () => {
  assert.deepEqual(
    [...getAllowedOrigins({
      NODE_ENV: "development",
      CORS_ALLOWED_ORIGINS: "https://sendflow.example/, preview.example",
    })],
    ["https://sendflow.example", "https://preview.example"],
  );
  assert.equal(normalizeHttpOrigin("https://sendflow.example/path"), null);
  assert.equal(normalizeHttpOrigin("javascript:alert(1)"), null);
  assert.equal(normalizeHttpOrigin("https://user@sendflow.example"), null);
});

test("production origin policy excludes the Replit development hostname", () => {
  const origins = getAllowedOrigins({
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://sendflow.example, https://sendflow-preview.replit.dev",
    REPLIT_DOMAINS: "sendflow.example, http://insecure.example",
    REPLIT_DEV_DOMAIN: "sendflow-preview.replit.dev",
  });

  assert.deepEqual([...origins], ["https://sendflow.example"]);
});

test("development origin policy includes the configured preview hostname", () => {
  const origins = getAllowedOrigins({
    NODE_ENV: "development",
    REPLIT_DEV_DOMAIN: "sendflow-preview.replit.dev",
  });

  assert.equal(origins.has("https://sendflow-preview.replit.dev"), true);
});

test("forwarded hosts must exactly match a configured allowed origin", () => {
  const environment = {
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://sendflow.example",
  };

  assert.equal(getTrustedHost("sendflow.example", environment), "sendflow.example");
  assert.equal(getTrustedHost("attacker.example", environment), undefined);
  assert.equal(getTrustedHost("sendflow.example, attacker.example", environment), undefined);
  assert.equal(getTrustedHost("sendflow.example/path", environment), undefined);
});

test("state-changing requests require a configured origin", () => {
  const environment = {
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://sendflow.example",
  };

  assert.equal(isAllowedRequestOrigin("https://sendflow.example", "POST", environment), true);
  assert.equal(isAllowedRequestOrigin("https://attacker.example", "POST", environment), false);
  assert.equal(isAllowedRequestOrigin(undefined, "POST", environment), false);
  assert.equal(isAllowedRequestOrigin(undefined, "GET", environment), true);
  assert.equal(
    isAllowedRequestOrigin(["https://sendflow.example", "https://attacker.example"], "POST", environment),
    false,
  );
});
