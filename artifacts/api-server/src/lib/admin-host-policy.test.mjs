import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAdminAllowedHosts,
  isAdminHostAllowed,
} from "./admin-host-policy.ts";

test("admin host allowlist uses exact normalized host entries", () => {
  const environment = {
    SENDFLOW_ADMIN_ALLOWED_HOSTS: "Admin.Example.test, second.example.test",
  };
  assert.deepEqual(
    [...getAdminAllowedHosts(environment)].sort(),
    ["admin.example.test", "second.example.test"],
  );
  assert.equal(isAdminHostAllowed("admin.example.test", environment), true);
  assert.equal(isAdminHostAllowed("not-admin.example.test", environment), false);
  assert.equal(isAdminHostAllowed("admin.example.test:443", environment), true);
  assert.equal(isAdminHostAllowed("admin.example.test:444", environment), false);
});

test("missing or malformed host configuration fails closed", () => {
  assert.equal(getAdminAllowedHosts({}), null);
  assert.equal(isAdminHostAllowed("admin.example.test", {}), false);
  assert.equal(
    isAdminHostAllowed("admin.example.test", {
      SENDFLOW_ADMIN_ALLOWED_HOSTS: "*.example.test",
    }),
    false,
  );
  assert.equal(
    getAdminAllowedHosts({
      SENDFLOW_ADMIN_ALLOWED_HOSTS: "admin.example.test,https://second.example.test/path",
    }),
    null,
  );
  assert.equal(isAdminHostAllowed("admin.example.test,attacker.test", {
    SENDFLOW_ADMIN_ALLOWED_HOSTS: "admin.example.test",
  }), false);
});
