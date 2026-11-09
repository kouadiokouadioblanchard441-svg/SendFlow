import assert from "node:assert/strict";
import { test } from "node:test";
import { isAdminHostAllowed } from "./admin-host-policy.ts";

test("administrator host allowlist matches exact normalized host values", () => {
  const env = { SENDFLOW_ADMIN_ALLOWED_HOSTS: "admin.example.test, admin-alt.example.test:443" };
  assert.equal(isAdminHostAllowed("ADMIN.EXAMPLE.TEST", env), true);
  assert.equal(isAdminHostAllowed("admin-alt.example.test", env), true);
  assert.equal(isAdminHostAllowed("admin.example.test.evil.test", env), false);
  assert.equal(isAdminHostAllowed("admin.example.test:444", env), false);
});

test("missing, wildcard, and malformed administrator host configuration fails closed", () => {
  assert.equal(isAdminHostAllowed("admin.example.test", {}), false);
  assert.equal(isAdminHostAllowed("admin.example.test", {
    SENDFLOW_ADMIN_ALLOWED_HOSTS: "*.example.test",
  }), false);
  assert.equal(isAdminHostAllowed("admin.example.test", {
    SENDFLOW_ADMIN_ALLOWED_HOSTS: "admin.example.test,https://other.example.test",
  }), false);
});
