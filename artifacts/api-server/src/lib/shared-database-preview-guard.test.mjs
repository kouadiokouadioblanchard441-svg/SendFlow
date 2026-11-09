import assert from "node:assert/strict";
import test from "node:test";
import {
  isSharedDatabasePreview,
  isViewerRouteCandidate,
  shouldBlockSharedDatabaseApiRequest,
} from "./shared-database-preview-guard.ts";
import {
  isPaymentTestSessionForSharedDatabase,
  isReplitPaymentTestHost,
} from "./replit-payment-test-access-policy.ts";

const sharedDatabase = {
  NODE_ENV: "development",
  REPL_ID: "repl-test",
  SENDFLOW_DATABASE_TARGET: "shared-external",
};

test("shared-database preview is identified without granting write access", () => {
  assert.equal(isSharedDatabasePreview(sharedDatabase), true);
  assert.equal(isViewerRouteCandidate("POST", "/api/me/payments"), true);
  assert.equal(shouldBlockSharedDatabaseApiRequest("POST", "/api/me/payments", sharedDatabase), true);
  assert.equal(shouldBlockSharedDatabaseApiRequest("GET", "/api/pricing", sharedDatabase), false);
});

test("only known public GET routes are allowed in the shared preview", () => {
  for (const path of [
    "/api/auth/session",
    "/api/me",
    "/api/me/developer/api-keys",
    "/api/admin/users",
    "/api/future-private-resource",
  ]) {
    assert.equal(shouldBlockSharedDatabaseApiRequest("GET", path, sharedDatabase), true, path);
  }
  assert.equal(
    shouldBlockSharedDatabaseApiRequest("GET", "/api/auth/registration-countries", sharedDatabase),
    false,
  );
  assert.equal(
    shouldBlockSharedDatabaseApiRequest("GET", "/api/auth/registration-countries/unexpected", sharedDatabase),
    true,
  );
  assert.equal(
    shouldBlockSharedDatabaseApiRequest("POST", "/api/auth/registration-countries", sharedDatabase),
    true,
  );
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(shouldBlockSharedDatabaseApiRequest(method, "/api/pricing", sharedDatabase), true);
  }
  assert.equal(shouldBlockSharedDatabaseApiRequest("GET", "/api/pricing", sharedDatabase), false);
  assert.equal(shouldBlockSharedDatabaseApiRequest("OPTIONS", "/api/private", sharedDatabase), false);
});

test("malformed and encoded paths fail closed", () => {
  for (const path of ["/api/%2561uth/session", "/api/auth/../me", "/api/%E0%A4%A", "/api\\auth"]) {
    assert.equal(shouldBlockSharedDatabaseApiRequest("GET", path, sharedDatabase), true, path);
  }
});

test("payment-test access stays scoped to Replit and never follows from preview status alone", () => {
  assert.equal(isReplitPaymentTestHost({ ...sharedDatabase, FEEXPAY_EXECUTION_HOST: "replit" }), true);
  assert.equal(isReplitPaymentTestHost({ ...sharedDatabase, FEEXPAY_EXECUTION_HOST: "plesk" }), false);
  assert.equal(isReplitPaymentTestHost({ SENDFLOW_DATABASE_TARGET: "production", FEEXPAY_EXECUTION_HOST: "replit" }), false);
  assert.equal(isPaymentTestSessionForSharedDatabase({ paymentTestAccount: false }, sharedDatabase), false);
  assert.equal(isPaymentTestSessionForSharedDatabase({ paymentTestAccount: true }, sharedDatabase), true);
});
