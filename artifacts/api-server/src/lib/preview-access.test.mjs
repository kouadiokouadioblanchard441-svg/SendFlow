import assert from "node:assert/strict";
import test from "node:test";
import { isViewerRouteCandidate } from "./shared-neon-preview-guard.ts";
import { hashCustomerSecret, hashCustomerSessionToken, verifyCustomerSecret } from "./customer-auth-crypto.ts";
import { toPreviewPasswordHash, previewPasswordForVerification } from "./preview-credential-policy.ts";
import { randomBytes } from "node:crypto";

test("viewer candidate list does not admit new routes, payments, providers, registration or admin", () => {
  for (const [method, path] of [
    ["GET", "/api/auth/session"], ["POST", "/api/auth/sign-in"], ["POST", "/api/auth/unlock"],
    ["POST", "/api/auth/sign-out"], ["PUT", "/api/me/pin"], ["GET", "/api/me"],
    ["GET", "/api/me/transactions"], ["POST", "/api/me/transfer-quote"],
    ["GET", "/api/me/account-limit"], ["GET", "/api/me/identity-verification"],
  ]) assert.equal(isViewerRouteCandidate(method, path), true);
  for (const [method, path] of [
    ["POST", "/api/me/identity-verification"], ["POST", "/api/auth/send-otp"],
    ["POST", "/api/auth/register"], ["POST", "/api/auth/reset-pin"],
    ["POST", "/api/auth/reset-password"], ["GET", "/api/admin"],
    ["GET", "/api/me/transactions/other-user"], ["PUT", "/api/me"],
    ["GET", "/api/me/profile"], ["PATCH", "/api/me/profile"],
    ["GET", "/api/me/account-limit/unknown"], ["POST", "/api/me/transfer-quote/unknown"],
    ["GET", "/api/me/../admin"], ["GET", "/api/me%00"], ["GET", "/api/%zz"],
    ["POST", "/api/payments"], ["GET", "/api/me/future-route"],
  ]) assert.equal(isViewerRouteCandidate(method, path), false);
});
test("viewer passwords cannot be verified by the production verifier", async () => {
  const secret = randomBytes(16).toString("hex");
  const hash = await hashCustomerSecret(secret);
  const viewerHash = toPreviewPasswordHash(hash);
  assert.equal(await verifyCustomerSecret(secret, viewerHash), false);
  assert.equal(await verifyCustomerSecret(secret, previewPasswordForVerification(viewerHash)), true);
  assert.equal(previewPasswordForVerification(hash), "");
  assert.throws(() => toPreviewPasswordHash("unsupported"));
});
test("a cookie from one realm cannot authenticate in the other; production hashing stays SHA-256", async () => {
  const { createHash } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  const normal = hashCustomerSessionToken(token, { SENDFLOW_DATABASE_TARGET: "production" });
  assert.equal(normal, createHash("sha256").update(token).digest("hex"));
  const preview = hashCustomerSessionToken(token, { SENDFLOW_DATABASE_TARGET: "shared-neon" });
  assert.notEqual(normal, preview);
  assert.match(preview, /^pv1_[0-9a-f]{60}$/);
});
