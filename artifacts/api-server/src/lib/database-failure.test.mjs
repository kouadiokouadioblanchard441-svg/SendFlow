import assert from "node:assert/strict";
import test from "node:test";
import { classifyDatabaseFailure } from "./database-failure.ts";

test("classifies known PostgreSQL availability, TLS, access, and schema failures", () => {
  assert.equal(
    classifyDatabaseFailure(Object.assign(new Error("private"), { code: "ETIMEDOUT" })),
    "database_unavailable",
  );
  assert.equal(
    classifyDatabaseFailure(Object.assign(new Error("private"), {
      cause: Object.assign(new Error("private"), { code: "SELF_SIGNED_CERT_IN_CHAIN" }),
    })),
    "database_tls_failure",
  );
  assert.equal(
    classifyDatabaseFailure(Object.assign(new Error("private"), { code: "42501" })),
    "database_access_denied",
  );
  assert.equal(
    classifyDatabaseFailure(Object.assign(new Error("private"), { code: "42703" })),
    "database_schema_mismatch",
  );
  assert.equal(
    classifyDatabaseFailure(Object.assign(new Error("private"), { code: "XX000" })),
    "database_query_failed",
  );
});

test("does not invoke hostile error getters", () => {
  const hostile = {
    get code() {
      throw new Error("private marker");
    },
    get cause() {
      throw new Error("private marker");
    },
  };
  assert.equal(classifyDatabaseFailure(hostile), "database_query_failed");
});
