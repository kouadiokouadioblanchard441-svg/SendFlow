import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  ANONYMOUS_CSRF_COOKIE,
  ANONYMOUS_CSRF_COOKIE_TTL_MS,
  CSRF_HEADER_NAME,
  CSRF_TOKEN_TTL_MS,
  createAnonymousCsrfCookie,
  createCsrfToken,
  verifyCsrfToken,
} from "./csrf-protection.ts";
import { apiRequestSecurity } from "./api-request-security.ts";

const previousSessionSecret = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = "csrf-unit-test-secret-at-least-32-bytes-long";
after(() => {
  if (previousSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSessionSecret;
});

const trustedOrigin = "https://sendflow-test.invalid";
const guard = apiRequestSecurity(new Set([trustedOrigin]));

function invoke(method, path, { origin, cookie, csrfToken } = {}) {
  const result = { status: null, next: false, headers: {}, cookies: [] };
  const requestHeaders = {
    ...(origin === undefined ? {} : { origin }),
    ...(cookie ? { cookie } : {}),
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  };
  const req = {
    method,
    path,
    headers: requestHeaders,
    get(name) { return requestHeaders[name.toLowerCase()]; },
    log: { error() {} },
  };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    cookie(name, value, options) { result.cookies.push({ name, value, options }); },
    status(value) { result.status = value; return this; },
    json(body) { result.body = body; return this; },
  };
  guard(req, res, () => { result.next = true; });
  return result;
}

function anonymousBootstrap() {
  const response = invoke("GET", "/auth/session");
  assert.equal(response.next, true);
  const [cookie] = response.cookies;
  assert.ok(cookie, "a pre-authentication CSRF binding cookie should be issued");
  return {
    cookie: `${cookie.name}=${cookie.value}`,
    token: response.headers[CSRF_HEADER_NAME],
    cookieRecord: cookie,
  };
}

test("all unsafe methods reject absent, malformed and foreign origins before CSRF validation", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "TRACE"]) {
    for (const origin of [
      undefined,
      "null",
      "sendflow-test.invalid",
      "//sendflow-test.invalid",
      "https://sendflow-test.invalid.evil.invalid",
      "https://sendflow-test.invalid/path",
    ]) {
      const result = invoke(method, "/me/profile", { origin });
      assert.equal(result.status, 403, `${method} ${origin}`);
      assert.equal(result.next, false);
      assert.notEqual(result.body?.code, "csrf_token_invalid");
      assert.equal(result.headers["Cache-Control"], "no-store, private");
    }
  }
});

test("safe reads issue a short-lived HttpOnly binding cookie and expose a token", () => {
  const response = invoke("GET", "/auth/session");
  assert.equal(response.next, true);
  assert.ok(response.headers[CSRF_HEADER_NAME]);
  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0].name, ANONYMOUS_CSRF_COOKIE);
  assert.equal(response.cookies[0].options.httpOnly, true);
  assert.equal(response.cookies[0].options.secure, true);
  assert.equal(response.cookies[0].options.sameSite, "none");
  assert.equal(response.cookies[0].options.path, "/");
  assert.equal(response.cookies[0].options.domain, undefined);
  assert.equal(response.cookies[0].options.maxAge, ANONYMOUS_CSRF_COOKIE_TTL_MS);
  assert.equal(response.cookies[0].value.split(".").length, 4);
  const renewedToken = invoke("GET", "/auth/session", {
    cookie: `${response.cookies[0].name}=${response.cookies[0].value}`,
  });
  assert.equal(renewedToken.cookies.length, 0);
  assert.notEqual(renewedToken.headers[CSRF_HEADER_NAME], response.headers[CSRF_HEADER_NAME]);
  assert.equal(verifyCsrfToken(
    response.headers[CSRF_HEADER_NAME],
    `anonymous:v1:${response.cookies[0].value.split(".")[1]}:${response.cookies[0].value.split(".")[2]}`,
  ), true);
  for (const method of ["HEAD", "OPTIONS"]) {
    assert.equal(invoke(method, "/me", {}).next, true);
  }
});

test("untrusted anonymous cookies are replaced, never reflected or accepted", () => {
  const chosenCookieValue = "a".repeat(43);
  const response = invoke("GET", "/auth/session", {
    cookie: `${ANONYMOUS_CSRF_COOKIE}=${chosenCookieValue}`,
  });
  assert.equal(response.cookies.length, 1);
  assert.notEqual(response.cookies[0].value, chosenCookieValue);
  assert.equal(response.cookies[0].value.split(".").length, 4);

  const forgedCookie = `${ANONYMOUS_CSRF_COOKIE}=${chosenCookieValue}`;
  const forged = invoke("POST", "/me/profile", {
    origin: trustedOrigin,
    cookie: forgedCookie,
    csrfToken: response.headers[CSRF_HEADER_NAME],
  });
  assert.equal(forged.status, 403);

  const accepted = invoke("POST", "/me/profile", {
    origin: trustedOrigin,
    cookie: `${ANONYMOUS_CSRF_COOKIE}=${response.cookies[0].value}`,
    csrfToken: response.headers[CSRF_HEADER_NAME],
  });
  assert.equal(accepted.next, true);
});

test("expired or tampered anonymous binding cookies cannot authorize mutations", () => {
  const expiredCookie = createAnonymousCsrfCookie(Date.now() - ANONYMOUS_CSRF_COOKIE_TTL_MS);
  const expired = invoke("GET", "/auth/session", {
    cookie: `${ANONYMOUS_CSRF_COOKIE}=${expiredCookie.value}`,
  });
  assert.equal(expired.cookies.length, 1);
  assert.notEqual(expired.cookies[0].value, expiredCookie.value);

  const bootstrap = anonymousBootstrap();
  const value = bootstrap.cookie.slice(`${ANONYMOUS_CSRF_COOKIE}=`.length);
  const parts = value.split(".");
  parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith("A") ? "B" : "A"}`;
  const tamperedCookie = `${ANONYMOUS_CSRF_COOKIE}=${parts.join(".")}`;
  const rejected = invoke("POST", "/me/profile", {
    origin: trustedOrigin,
    cookie: tamperedCookie,
    csrfToken: bootstrap.token,
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.body.code, "csrf_token_invalid");
});

test("all unsafe methods require a valid token and accept a fresh token for the current cookie binding", () => {
  const bootstrap = anonymousBootstrap();
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const missing = invoke(method, "/me/profile", { origin: trustedOrigin, cookie: bootstrap.cookie });
    assert.equal(missing.status, 403);
    assert.equal(missing.body.code, "csrf_token_invalid");

    const accepted = invoke(method, "/me/profile", {
      origin: trustedOrigin,
      cookie: bootstrap.cookie,
      csrfToken: bootstrap.token,
    });
    assert.equal(accepted.next, true, `${method} with a valid token`);
  }
});

test("invalid, expired and session-mismatched tokens are rejected", () => {
  const bootstrap = anonymousBootstrap();
  const invalid = invoke("POST", "/me/transfer-quote", {
    origin: trustedOrigin,
    cookie: bootstrap.cookie,
    csrfToken: `${bootstrap.token}tampered`,
  });
  assert.equal(invalid.status, 403);
  assert.equal(invalid.body.code, "csrf_token_invalid");

  const [version, expiresAt, nonce] = bootstrap.cookie
    .slice(`${ANONYMOUS_CSRF_COOKIE}=`.length)
    .split(".");
  assert.equal(version, "v1");
  const binding = `anonymous:v1:${expiresAt}:${nonce}`;
  const now = Date.now();
  const expiredToken = createCsrfToken(binding, now - CSRF_TOKEN_TTL_MS);
  const expired = invoke("POST", "/me/transfer-quote", {
    origin: trustedOrigin,
    cookie: bootstrap.cookie,
    csrfToken: expiredToken,
  });
  assert.equal(expired.status, 403);
  assert.equal(expired.body.code, "csrf_token_invalid");

  const sessionCookie = `__Host-sendflow_session=${"a".repeat(43)}`;
  const sessionBootstrap = invoke("GET", "/auth/session", { cookie: sessionCookie });
  const changedSession = invoke("POST", "/private/settings", {
    origin: trustedOrigin,
    cookie: `__Host-sendflow_session=${"b".repeat(43)}`,
    csrfToken: sessionBootstrap.headers[CSRF_HEADER_NAME],
  });
  assert.equal(changedSession.status, 403);
  assert.equal(changedSession.body.code, "csrf_token_invalid");
});

test("a trusted origin with a valid token proceeds; an untrusted origin still fails", () => {
  const bootstrap = anonymousBootstrap();
  const accepted = invoke("POST", "/private/settings", {
    origin: trustedOrigin,
    cookie: bootstrap.cookie,
    csrfToken: bootstrap.token,
  });
  assert.equal(accepted.next, true);

  const rejected = invoke("POST", "/private/settings", {
    origin: "https://evil.invalid",
    cookie: bootstrap.cookie,
    csrfToken: bootstrap.token,
  });
  assert.equal(rejected.status, 403);
  assert.notEqual(rejected.body.code, "csrf_token_invalid");
});

test("only the exact signed Didit POST bypasses browser CSRF and origin checks", () => {
  assert.equal(invoke("POST", "/webhooks/didit").next, true);
  for (const path of [
    "/webhooks/didit/",
    "/webhooks/didit/extra",
    "/webhooks/feexpay",
    "/webhooks/didit%2f",
    "/WEBHOOKS/DIDIT",
  ]) {
    assert.equal(invoke("POST", path).status, 403, path);
  }
  assert.equal(invoke("PUT", "/webhooks/didit").status, 403);
});

test("CSRF tokens are signed, session-bound, unpredictable and expire", () => {
  const now = 1_800_000_000_000;
  const token = createCsrfToken("customer-session-a", now);
  assert.equal(verifyCsrfToken(token, "customer-session-a", now + 1), true);
  assert.equal(verifyCsrfToken(token, "customer-session-b", now + 1), false);
  assert.equal(verifyCsrfToken(token, "customer-session-a", now + CSRF_TOKEN_TTL_MS), false);
  assert.equal(verifyCsrfToken(`${token}x`, "customer-session-a", now + 1), false);
  assert.equal(verifyCsrfToken(undefined, "customer-session-a", now + 1), false);
  assert.notEqual(createCsrfToken("customer-session-a", now), token);
});

test("missing server signing configuration fails closed without exposing details", () => {
  const previous = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  try {
    const bootstrap = invoke("GET", "/auth/session");
    assert.equal(bootstrap.status, 503);
    assert.equal(bootstrap.next, false);
    assert.equal(bootstrap.headers[CSRF_HEADER_NAME], undefined);

    const publicRead = invoke("GET", "/pricing");
    assert.equal(publicRead.next, true);
    assert.equal(publicRead.headers[CSRF_HEADER_NAME], undefined);

    const mutation = invoke("POST", "/me/profile", {
      origin: trustedOrigin,
      cookie: `${ANONYMOUS_CSRF_COOKIE}=${"a".repeat(43)}`,
      csrfToken: "unusable-token",
    });
    assert.equal(mutation.status, 403);
    assert.equal(mutation.body.code, "csrf_token_invalid");
    assert.doesNotMatch(JSON.stringify(mutation.body), /SESSION_SECRET|signing key/i);
  } finally {
    process.env.SESSION_SECRET = previous;
  }
});
