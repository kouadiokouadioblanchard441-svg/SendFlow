import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { before, after } from "node:test";
import { routeInventory, adminPrefix, frontendPaths } from "./route-inventory.mjs";

if (!process.env.SENDFLOW_ISOLATED_RUNTIME?.includes("/sendflow-isolated-finance-")
  || !process.env.SENDFLOW_FIXTURE_SOCKET?.includes("/sendflow-isolated-finance-")) {
  throw new Error("Run only through the isolated PostgreSQL runner");
}
const require = createRequire(import.meta.url);
// Enforce the no-provider-call guarantee independently of server configuration.
globalThis.fetch = async () => { throw new Error("External network forbidden in route audit"); };
const { app, pool, createSiteServer, hashAdminSessionToken, ADMIN_SESSION_COOKIE, hashCustomerSecret } =
  require(process.env.SENDFLOW_ISOLATED_RUNTIME);
const pg = require("pg");
const owner = new pg.Pool({ host: process.env.SENDFLOW_FIXTURE_SOCKET, port: 15432,
  database: "postgres", user: "sf_fixture_owner" });
const routes = routeInventory();
const adminToken = randomBytes(32).toString("base64url");
let server, site;
const siteRoot = mkdtempSync(join(tmpdir(), "sendflow-route-static-"));

before(async () => {
  await owner.query("INSERT INTO sf_registration_settings(id) VALUES('signup')");
  await owner.query("INSERT INTO sf_users(id,status) VALUES('audit-admin','active')");
  await owner.query("INSERT INTO sf_admin_grants(user_id,can_mutate,pin_hash) VALUES('audit-admin',true,$1)",
    [await hashCustomerSecret(randomBytes(16).toString("hex"))]);
  await owner.query(`INSERT INTO sf_admin_sessions(user_id,authorization_version,token_hash,expires_at,pin_verified_until)
    SELECT user_id,authorization_version,$1,now()+interval '1 hour',now()+interval '10 minutes'
    FROM sf_admin_grants WHERE user_id='audit-admin'`,
  [hashAdminSessionToken(adminToken)]);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  writeFileSync(join(siteRoot, "index.html"), "<!doctype html><html><body>SPA fixture</body></html>");
  site = createSiteServer(siteRoot);
  site.listen(0, "127.0.0.1");
  await once(site, "listening");
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (site) await new Promise((resolve) => site.close(resolve));
  await pool.end();
  await owner.end();
  rmSync(siteRoot, { recursive: true, force: true });
});

function concretePath(path) {
  return path.replace(/:[A-Za-z]+/g, "00000000-0000-4000-8000-000000000001")
    .replace("*filePath", "audit-missing-object.png");
}

function request(path, { method = "GET", origin = "https://sendflow-test.invalid",
  rawBody, headers = {}, target = server } = {}) {
  return new Promise((resolve, reject) => {
    const data = rawBody ?? (["GET", "HEAD"].includes(method) ? undefined : "{}");
    const req = http.request({
      host: "127.0.0.1", port: target.address().port, path: concretePath(path), method,
      headers: {
        ...(origin === null ? {} : { Origin: origin }),
        ...(data === undefined ? {} : {
          "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data),
        }),
        ...headers,
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("inventory covers mounted customer, administrative, auth, webhook and public declarations", () => {
  assert.ok(routes.length > 0, "No route declarations were discovered");
  for (const category of ["admin", "customer", "authentication", "webhook", "public-read"]) {
    assert.ok(routes.some((route) => route.category === category), category);
  }
  console.info(JSON.stringify({ routeInventory: routes.length,
    categories: Object.fromEntries([...new Set(routes.map((r) => r.category))]
      .map((key) => [key, routes.filter((r) => r.category === key).length])) }));
});

for (const route of routes.filter((r) => ["admin", "customer"].includes(r.category))) {
  const isAccessEndpoint = route.category === "admin"
    && ["/access", "/sign-in", "/sign-out", "/pin/unlock"].some((p) => route.path === `/api${adminPrefix}${p}`);
  test(`${route.method} ${route.path} refuses anonymous sensitive access`, async () => {
    const response = await request(route.path, { method: route.method });
    if (isAccessEndpoint) {
      // The access bootstrap is deliberately public; an empty sign-in never authenticates.
      assert.ok([200, 400, 401, 403, 204].includes(response.status));
      if (response.status === 200) {
        const body = JSON.parse(response.text);
        assert.equal(body.isAdmin, false);
        assert.equal(body.canMutate, false);
      }
    } else {
      assert.equal(response.status, route.method === "GET" ? 401 : 403, response.text);
      if (route.method !== "GET") {
        assert.equal(JSON.parse(response.text).code, "csrf_token_invalid");
      }
    }
    assert.match(response.headers["cache-control"], /no-store/);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["referrer-policy"], "no-referrer");
    for (const cookie of response.headers["set-cookie"] ?? []) {
      if (cookie.startsWith("__Host-sendflow_csrf=")) {
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /Secure/i);
        assert.match(cookie, /SameSite=None/i);
      } else {
        assert.match(cookie, /Expires=Thu, 01 Jan 1970|Max-Age=0/i);
      }
    }
  });
}

for (const route of routes.filter((r) => r.method !== "GET" && r.category !== "webhook")) {
  test(`${route.method} ${route.path} blocks missing and foreign origins`, async () => {
    for (const origin of [null, "https://untrusted.invalid"]) {
      const response = await request(route.path, { method: route.method, origin });
      assert.equal(response.status, 403, response.text);
      assert.match(response.headers["cache-control"], /no-store/);
    }
  });
}

for (const route of routes.filter((r) => r.category === "authentication")) {
  test(`${route.method} ${route.path} rejects mutations without a CSRF token`, async () => {
    const response = await request(route.path, { method: route.method });
    assert.equal(response.status, 403, response.text);
    assert.equal(JSON.parse(response.text).code, "csrf_token_invalid");
    assert.equal(response.headers["set-cookie"], undefined);
  });
}

for (const route of routes.filter((r) => r.category === "public-read")) {
  test(`${route.method} ${route.path} exposes only its deliberate public contract`, async () => {
    const response = await request(route.path);
    // No object-storage sidecar exists in this fixture. Other public reads must load.
    const expected = route.path.includes("/storage/") ? 503
      : route.path.includes("/operators/") ? 404
      : 200;
    assert.equal(response.status, expected, response.text);
    assert.doesNotMatch(response.text, /postgres(?:ql)?:\/\/|scrypt\$v1|BEGIN (?:RSA )?PRIVATE KEY|stackTrace/i);
    assert.ok((response.headers["set-cookie"] ?? [])
      .some((cookie) => cookie.startsWith("__Host-sendflow_csrf=")));
  });
}

test("unsigned webhook is rejected without browser Origin and without a database receipt", async () => {
  const before = await pool.query("SELECT count(*)::int AS n FROM sf_identity_webhook_events");
  for (const origin of [null, "https://untrusted.invalid"]) {
    const response = await request("/api/webhooks/didit", { method: "POST", origin });
    assert.equal(response.status, 401);
  }
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM sf_identity_webhook_events");
  assert.equal(rows[0].n, before.rows[0].n);
});

test("valid CSRF tokens pass the global guard while customer and admin routes still require authorization", async () => {
  const bootstrap = await request("/api/auth/session");
  assert.ok(bootstrap.headers["x-csrf-token"]);
  assert.match(bootstrap.headers["access-control-expose-headers"], /x-csrf-token/i);
  const csrfCookie = bootstrap.headers["set-cookie"]
    ?.find((cookie) => cookie.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  assert.ok(csrfCookie);
  const headers = {
    Cookie: csrfCookie,
    "X-CSRF-Token": bootstrap.headers["x-csrf-token"],
  };
  const before = await pool.query("SELECT count(*)::int AS n FROM sf_transactions");
  const customer = await request("/api/me/transfer-quote", { method: "POST", headers });
  assert.equal(customer.status, 401, customer.text);
  const admin = await request(`/api${adminPrefix}/operator-pricing-rates`, {
    method: "PUT",
    headers,
  });
  assert.equal(admin.status, 401, admin.text);
  const after = await pool.query("SELECT count(*)::int AS n FROM sf_transactions");
  assert.equal(after.rows[0].n, before.rows[0].n);
});

test("CORS preflight permits the CSRF header only for an allowed origin", async () => {
  const preflight = await request("/api/me/transfer-quote", {
    method: "OPTIONS",
    rawBody: "",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-csrf-token",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], "https://sendflow-test.invalid");
  assert.equal(preflight.headers["access-control-allow-credentials"], "true");
  assert.match(preflight.headers["access-control-allow-headers"], /x-csrf-token/i);
});

test("public object proxy preserves safe headers and bounds the mocked object request", async () => {
  const previousPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  const blockedFetch = globalThis.fetch;
  process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/fixture-bucket/public";
  let signed = false, fetched = false;
  globalThis.fetch = async (input, options) => {
    if (input === "http://127.0.0.1:1106/object-storage/signed-object-url") {
      signed = true;
      assert.deepEqual(JSON.parse(options.body).object_name, "public/audit.html");
      return new Response(JSON.stringify({ signed_url: "https://storage.googleapis.com/fixture-bucket/public/audit.html" }));
    }
    assert.equal(input, "https://storage.googleapis.com/fixture-bucket/public/audit.html");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    fetched = true;
    return new Response("<html>fixture</html>", { headers: { "Content-Type": "text/html",
      "Set-Cookie": "forged=fixture", "X-Content-Type-Options": "unsafe",
      "Content-Security-Policy": "script-src *" } });
  };
  try {
    const response = await request("/api/storage/public-objects/audit.html");
    assert.equal(response.status, 200);
    assert.ok(signed && fetched);
    assert.equal(response.headers["content-disposition"], "attachment");
    assert.ok(response.headers["set-cookie"]
      .some((cookie) => cookie.startsWith("__Host-sendflow_csrf=")));
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.match(response.headers["content-security-policy"], /^sandbox;/);
  } finally {
    globalThis.fetch = blockedFetch;
    if (previousPaths === undefined) delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    else process.env.PUBLIC_OBJECT_SEARCH_PATHS = previousPaths;
  }
});

for (const path of frontendPaths()) {
  test(`GET ${path} visits the frontend static route without exposing private server files`, async () => {
    const response = await request(path, { target: site });
    assert.equal(response.status, 200);
    assert.equal(response.text, "<!doctype html><html><body>SPA fixture</body></html>");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.match(response.headers["cache-control"], /no-store/);
  });
}

test("frontend origin refuses hidden files, source maps, API fallbacks and mutation methods", async () => {
  for (const path of ["/.env", "/assets/private.js.map", "/api/not-a-page", "/%2eenv"]) {
    const response = await request(path, { target: site });
    assert.ok([403, 404].includes(response.status), `${path}: ${response.status}`);
  }
  const response = await request("/", { target: site, method: "POST" });
  assert.equal(response.status, 405);
});

test("untrusted requests are rejected before parsing malformed bodies or consuming quotas", async () => {
  const response = await request("/api/me/transfer-quote", { method: "POST", rawBody: "{",
    origin: "https://untrusted.invalid" });
  assert.equal(response.status, 403);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM sf_api_request_limits");
  assert.equal(rows[0].n, 0);
});

test("unknown API and lookalike webhook paths fail closed without sensitive diagnostics", async () => {
  for (const path of ["/api/unknown-route", "/api/webhooks/didit/extra"]) {
    const read = await request(path);
    assert.equal(read.status, 404);
    const write = await request(path, { method: "POST", origin: null });
    assert.equal(write.status, 403);
    assert.doesNotMatch(read.text, /Error:|node_modules|postgresql:/);
  }
});

test("full mounted admin router preserves allowed catalogue reads and rejects scope escalation", async () => {
  const headers = { Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` };
  const allowed = await request(`/api${adminPrefix}/operator-pricing`, { headers });
  assert.equal(allowed.status, 200, allowed.text);
  for (const path of ["/overview", "/users", "/network-defense", "/ip-blocklist"]) {
    const blocked = await request(`/api${adminPrefix}${path}`, { headers });
    assert.equal(blocked.status, 403, blocked.text);
  }
  const forged = await request(`/api${adminPrefix}/operator-pricing`, {
    headers: { Cookie: `__Host-sendflow_session=${adminToken}`, "x-admin-role": "owner" },
  });
  assert.equal(forged.status, 401);
});

test("an authorized admin mutation with a valid CSRF token reaches validation without changing data", async () => {
  const cookie = `${ADMIN_SESSION_COOKIE}=${adminToken}`;
  const bootstrap = await request("/api/auth/session", { headers: { Cookie: cookie } });
  assert.ok(bootstrap.headers["x-csrf-token"]);
  const before = await pool.query("SELECT count(*)::int AS n FROM sf_admin_audit_logs");
  const response = await request(`/api${adminPrefix}/operator-pricing-rates`, {
    method: "PUT",
    headers: {
      Cookie: cookie,
      "X-CSRF-Token": bootstrap.headers["x-csrf-token"],
    },
  });
  assert.equal(response.status, 400, response.text);
  assert.notEqual(JSON.parse(response.text).code, "csrf_token_invalid");
  const after = await pool.query("SELECT count(*)::int AS n FROM sf_admin_audit_logs");
  assert.equal(after.rows[0].n, before.rows[0].n);
});

test("full mounted admin router enforces current mutation rights and PIN before catalogue handlers", async () => {
  const headers = { Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` };
  await owner.query("UPDATE sf_admin_sessions SET pin_verified_until=NULL WHERE user_id='audit-admin'");
  assert.equal((await request(`/api${adminPrefix}/operator-pricing`, { headers })).status, 403);
  await owner.query("UPDATE sf_admin_sessions SET pin_verified_until=now()+interval '10 minutes' WHERE user_id='audit-admin'");
  await owner.query("UPDATE sf_admin_grants SET can_mutate=false WHERE user_id='audit-admin'");
  // Grant mutations may revoke this session; neither rejection may reach a handler.
  const denied = await request(`/api${adminPrefix}/operator-pricing-rates`, {
    method: "PUT", headers,
  });
  assert.ok([401, 403].includes(denied.status), denied.text);
});
