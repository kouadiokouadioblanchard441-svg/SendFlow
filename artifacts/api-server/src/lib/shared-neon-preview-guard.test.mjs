import assert from "node:assert/strict";
import test from "node:test";
import { shouldBlockSharedNeonApiRequest } from "./shared-neon-preview-guard.ts";

const ADMIN_ROUTE_PREFIX = "/DMgrgmt-1np5g23g12bGFtMwh";
const sharedNeon = {
  NODE_ENV: "development",
  REPL_ID: "repl-test",
  SENDFLOW_DATABASE_TARGET: "shared-neon",
};

test("blocks account, recovery, OTP, private data, identity, and admin paths in shared-Neon preview", () => {
  const blockedRequests = [
    ["POST", "/api/auth/register"],
    ["POST", "/api/auth/sign-in"],
    ["GET", "/api/auth/session"],
    ["POST", "/api/auth/send-otp"],
    ["POST", "/api/auth/verify-otp"],
    ["POST", "/api/auth/reset-password"],
    ["POST", "/api/auth/reset-pin"],
    ["GET", "/api/me"],
    ["GET", "/api/me/profile"],
    ["PATCH", "/api/me/profile"],
    ["GET", "/api/me/transactions?limit=50"],
    ["GET", "/api/identity-verification/status"],
    ["GET", `/api${ADMIN_ROUTE_PREFIX}/access`],
    ["PATCH", `/api${ADMIN_ROUTE_PREFIX}/registration-settings`],
    ["POST", "/api/wallet/transfer"],
  ];

  for (const [method, path] of blockedRequests) {
    assert.equal(
      shouldBlockSharedNeonApiRequest(method, path, sharedNeon),
      true,
      `${method} ${path} should be blocked`,
    );
  }
});

test("keeps only public reads and preflight requests available", () => {
  const allowedRequests = [
    ["GET", "/api/auth/registration-settings"],
    ["GET", "/api/banners"],
    ["GET", "/api/db-status"],
    ["GET", "/api/healthz"],
    ["GET", "/api/pricing"],
    ["GET", "/api/storage/public-objects/banners/hero.png"],
    ["OPTIONS", "/api/auth/sign-in"],
    ["OPTIONS", "/api/auth/send-otp"],
  ];

  for (const [method, path] of allowedRequests) {
    assert.equal(
      shouldBlockSharedNeonApiRequest(method, path, sharedNeon),
      false,
      `${method} ${path} should remain available`,
    );
  }

  assert.equal(
    shouldBlockSharedNeonApiRequest("POST", "/api/auth/registration-settings", sharedNeon),
    true,
  );
});

test("fails closed for malformed or encoded auth paths in shared-Neon preview", () => {
  assert.equal(
    shouldBlockSharedNeonApiRequest("GET", "/api/%2561uth/session", sharedNeon),
    true,
  );
  assert.equal(
    shouldBlockSharedNeonApiRequest("GET", "/api/auth/../me", sharedNeon),
    true,
  );
  assert.equal(
    shouldBlockSharedNeonApiRequest("GET", "/api/%E0%A4%A", sharedNeon),
    true,
  );
  assert.equal(
    shouldBlockSharedNeonApiRequest("GET", "/api/future-private-resource", sharedNeon),
    true,
  );
});

test("does not restrict the production or isolated development database targets", () => {
  const requests = [
    ["POST", "/api/auth/register"],
    ["GET", "/api/me"],
    ["PATCH", `/api${ADMIN_ROUTE_PREFIX}/registration-settings`],
  ];

  for (const environment of [
    { NODE_ENV: "production", SENDFLOW_DATABASE_TARGET: "production" },
    { NODE_ENV: "development", REPL_ID: "repl-test", SENDFLOW_DATABASE_TARGET: "development" },
  ]) {
    for (const [method, path] of requests) {
      assert.equal(
        shouldBlockSharedNeonApiRequest(method, path, environment),
        false,
        `${method} ${path} should not be blocked for ${environment.SENDFLOW_DATABASE_TARGET}`,
      );
    }
  }
});
