import assert from "node:assert/strict";
import { test } from "node:test";
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
    assert.doesNotThrow(() => assertExternalProviderCallsAllowed("Resend"));
  });

  for (const environment of ["development", "test", ""]) {
    withNodeEnvironment(environment, () => {
      assert.throws(
        () => assertExternalProviderCallsAllowed("Resend"),
        ExternalProviderCallUnavailableError,
      );
    });
  }
});
