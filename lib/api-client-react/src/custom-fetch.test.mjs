import assert from "node:assert/strict";
import { test } from "node:test";

import { customFetch, resolveApiUrl, setBaseUrl } from "./custom-fetch.ts";

test("resolveApiUrl prepends the configured API origin to relative paths", () => {
  setBaseUrl("https://app.africa.sendflow.africa/");
  try {
    assert.equal(
      resolveApiUrl("/api/me"),
      "https://app.africa.sendflow.africa/api/me",
    );
    assert.equal(
      resolveApiUrl("https://other.example/api/me"),
      "https://other.example/api/me",
    );
  } finally {
    setBaseUrl(null);
  }
});

test("customFetch includes session cookies by default and preserves explicit overrides", async () => {
  const originalFetch = globalThis.fetch;
  const captured = [];
  globalThis.fetch = async (input, init) => {
    captured.push({ input: String(input), credentials: init.credentials });
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  setBaseUrl("https://app.africa.sendflow.africa");
  try {
    await customFetch("/api/me", { responseType: "json" });
    await customFetch("/api/public", {
      responseType: "json",
      credentials: "omit",
    });

    assert.deepEqual(captured, [
      {
        input: "https://app.africa.sendflow.africa/api/me",
        credentials: "include",
      },
      {
        input: "https://app.africa.sendflow.africa/api/public",
        credentials: "omit",
      },
    ]);
  } finally {
    setBaseUrl(null);
    globalThis.fetch = originalFetch;
  }
});
