import assert from "node:assert/strict";
import test from "node:test";
import {
  TURNSTILE_SITEVERIFY_URL,
  verifyTurnstileToken,
} from "./turnstile.ts";

const environment = {
  NODE_ENV: "production",
  CORS_ALLOWED_ORIGINS: "https://sendflow.example",
  TURNSTILE_SECRET_KEY: "test-secret-only",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("valid token must pass Siteverify, exact hostname, and expected action", async () => {
  let request;
  const result = await verifyTurnstileToken("one-time-test-token", "login", {
    environment,
    expectedHostname: "sendflow.example",
    remoteIp: "203.0.113.10",
    fetcher: async (url, init) => {
      request = { url, init, body: new URLSearchParams(init.body) };
      return response({
        success: true,
        hostname: "sendflow.example",
        action: "login",
      });
    },
  });

  assert.deepEqual(result, { success: true });
  assert.equal(request.url, TURNSTILE_SITEVERIFY_URL);
  assert.equal(request.init.method, "POST");
  assert.equal(request.body.get("secret"), environment.TURNSTILE_SECRET_KEY);
  assert.equal(request.body.get("response"), "one-time-test-token");
  assert.equal(request.body.get("remoteip"), "203.0.113.10");
});

test("remoteip is omitted unless it is a valid IP address", async () => {
  let sentBody = "";
  const result = await verifyTurnstileToken("token", "signup", {
    environment,
    expectedHostname: "sendflow.example",
    remoteIp: "spoofed, 203.0.113.10",
    fetcher: async (_url, init) => {
      sentBody = init.body;
      return response({
        success: true,
        hostname: "sendflow.example",
        action: "signup",
      });
    },
  });
  assert.deepEqual(result, { success: true });
  assert.equal(new URLSearchParams(sentBody).has("remoteip"), false);
});

test("missing token, rejected/consumed token, wrong hostname, and wrong action fail closed", async () => {
  const base = {
    environment,
    expectedHostname: "sendflow.example",
    fetcher: async () => response({
      success: false,
      "error-codes": ["timeout-or-duplicate"],
    }),
  };
  assert.deepEqual(await verifyTurnstileToken("", "login", base), {
    success: false, category: "missing_token", unavailable: false,
  });
  assert.deepEqual(await verifyTurnstileToken("consumed", "login", base), {
    success: false, category: "invalid_token", unavailable: false,
  });
  assert.deepEqual(await verifyTurnstileToken("token", "login", {
    ...base,
    fetcher: async () => response({ success: true, hostname: "attacker.example", action: "login" }),
  }), {
    success: false, category: "hostname_mismatch", unavailable: false,
  });
  assert.deepEqual(await verifyTurnstileToken("token", "login", {
    ...base,
    fetcher: async () => response({ success: true, hostname: "sendflow.example", action: "signup" }),
  }), {
    success: false, category: "action_mismatch", unavailable: false,
  });
});

test("missing server secret or an invalid hostname configuration fails closed", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return response({ success: true, hostname: "sendflow.example", action: "login" });
  };
  assert.deepEqual(await verifyTurnstileToken("token", "login", {
    environment: { ...environment, TURNSTILE_SECRET_KEY: undefined },
    expectedHostname: "sendflow.example",
    fetcher,
  }), {
    success: false, category: "configuration_unavailable", unavailable: true,
  });
  assert.deepEqual(await verifyTurnstileToken("token", "login", {
    environment,
    expectedHostname: "attacker.example",
    fetcher,
  }), {
    success: false, category: "configuration_unavailable", unavailable: true,
  });
  assert.equal(calls, 0);
});

test("Siteverify HTTP failures, malformed replies, and timeouts are unavailable", async () => {
  const options = {
    environment,
    expectedHostname: "sendflow.example",
  };
  assert.deepEqual(await verifyTurnstileToken("token", "login", {
    ...options,
    fetcher: async () => response({}, 503),
  }), {
    success: false, category: "siteverify_unavailable", unavailable: true,
  });
  assert.deepEqual(await verifyTurnstileToken("token", "login", {
    ...options,
    fetcher: async () => new Response("not-json", { status: 200 }),
  }), {
    success: false, category: "invalid_siteverify_response", unavailable: true,
  });
  assert.deepEqual(await verifyTurnstileToken("token", "login", {
    ...options,
    timeoutMs: 10,
    fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("simulated timeout")), { once: true });
    }),
  }), {
    success: false, category: "siteverify_unavailable", unavailable: true,
  });
});

