import assert from "node:assert/strict";
import { test } from "node:test";
import { createDiditSession } from "./didit.ts";
import {
  assertExternalProviderCallsAllowed,
  ExternalProviderCallUnavailableError,
} from "./provider-call-policy.ts";

function withNodeEnvironment(value, run) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

test("outbound provider requests are permitted only in production", () => {
  withNodeEnvironment("production", () => {
    assert.doesNotThrow(() => assertExternalProviderCallsAllowed("Didit"));
    assert.doesNotThrow(() => assertExternalProviderCallsAllowed("eSMS Verify"));
  });

  for (const environment of ["development", "test", ""]) {
    withNodeEnvironment(environment, () => {
      assert.throws(
        () => assertExternalProviderCallsAllowed("Didit"),
        ExternalProviderCallUnavailableError,
      );
      assert.throws(
        () => assertExternalProviderCallsAllowed("eSMS Verify"),
        ExternalProviderCallUnavailableError,
      );
    });
  }
});

test("Didit session creation fails closed before attempting a network request", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFetch = globalThis.fetch;
  let fetchCalled = false;
  process.env.NODE_ENV = "development";
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("Unexpected network request");
  };

  try {
    await assert.rejects(
      () => createDiditSession({ vendorData: "sendflow:test" }),
      ExternalProviderCallUnavailableError,
    );
    assert.equal(fetchCalled, false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    globalThis.fetch = previousFetch;
  }
});
