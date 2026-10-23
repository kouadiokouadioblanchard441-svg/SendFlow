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

test("unsafe API requests bootstrap a fresh CSRF token and attach it to the mutation", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), method: init.method, credentials: init.credentials,
      headers: new Headers(init.headers), body: init.body });
    if (String(input).endsWith("/api/auth/session")) {
      return new Response(null, {
        status: 401,
        headers: { "X-CSRF-Token": "fresh-server-token" },
      });
    }
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  setBaseUrl("https://app.africa.sendflow.africa");
  try {
    await customFetch("/api/me/transfer-quote", {
      method: "POST",
      body: "{}",
      responseType: "json",
    });

    assert.deepEqual(calls.map(({ input, method, credentials }) => ({ input, method, credentials })), [
      {
        input: "https://app.africa.sendflow.africa/api/auth/session",
        method: "GET",
        credentials: "include",
      },
      {
        input: "https://app.africa.sendflow.africa/api/me/transfer-quote",
        method: "POST",
        credentials: "include",
      },
    ]);
    assert.equal(calls[1].headers.get("x-csrf-token"), "fresh-server-token");
    assert.equal(calls[1].headers.get("content-type"), "application/json");
  } finally {
    setBaseUrl(null);
    globalThis.fetch = originalFetch;
  }
});

test("unsafe API requests fail closed when the server does not provide a CSRF token", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return new Response(null, { status: 503 });
  };
  try {
    await assert.rejects(
      customFetch("/api/me/identity-verification", {
        method: "POST",
        body: "{}",
      }),
      /could not obtain a CSRF security token/i,
    );
    assert.deepEqual(calls, ["/api/auth/session"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
