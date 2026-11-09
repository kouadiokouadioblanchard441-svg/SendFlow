import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
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
const {
  app,
  pool,
  createSiteServer,
  hashCustomerSessionToken,
  hashCustomerSecret,
  createSensitiveDataLookupIndex,
  encryptSensitiveData,
} =
  require(process.env.SENDFLOW_ISOLATED_RUNTIME);
const pg = require("pg");
const owner = new pg.Pool({ host: process.env.SENDFLOW_FIXTURE_SOCKET, port: 15432,
  database: "postgres", user: "sf_fixture_owner" });
const routes = routeInventory();
const adminToken = randomBytes(32).toString("base64url");
const readOnlyAdminToken = randomBytes(32).toString("base64url");
const blockedAccountId = randomUUID();
const blockedAccountEmail = `blocked-${randomUUID()}@example.invalid`;
const blockedAccountPassword = randomBytes(24).toString("base64url");
const turnstileTokens = new Map();
const usedTurnstileTokens = new Set();
let server, site, traceTransactionId;
const siteRoot = mkdtempSync(join(tmpdir(), "sendflow-route-static-"));

function createTurnstileTestToken(action) {
  const token = `isolated-route-${randomUUID()}`;
  turnstileTokens.set(token, action);
  return token;
}

function legacyAdminHeaders(extra = {}) {
  return {
    Cookie: `__Host-sendflow_admin=${adminToken}; __Host-sendflow-admin-pin=${readOnlyAdminToken}`,
    "x-admin-role": "owner",
    ...extra,
  };
}

globalThis.fetch = async (input, init) => {
  if (String(input) !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    throw new Error("External network forbidden in route audit");
  }
  const form = new URLSearchParams(init?.body ?? "");
  const token = form.get("response") ?? "";
  const action = turnstileTokens.get(token);
  const accepted = Boolean(
    action
    && !usedTurnstileTokens.has(token)
    && form.get("secret") === process.env.TURNSTILE_SECRET_KEY,
  );
  if (accepted) usedTurnstileTokens.add(token);
  return new Response(JSON.stringify(accepted
    ? { success: true, hostname: "sendflow-test.invalid", action }
    : { success: false, "error-codes": ["invalid-input-response"] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

before(async () => {
  await owner.query(`INSERT INTO sf_countries
    (country_code,country_name,phone_prefix,min_phone_digits,max_phone_digits,signup_enabled,created_by,updated_by)
    VALUES('ci','Côte d’Ivoire','+225',8,10,true,'audit-admin','audit-admin')
    ON CONFLICT (country_code) DO NOTHING`);
  await owner.query("INSERT INTO sf_registration_settings(id,default_country_code) VALUES('signup','ci')");
  await owner.query(
    "INSERT INTO sf_customer_service_settings(id) VALUES('global') ON CONFLICT (id) DO NOTHING",
  );
  await owner.query("INSERT INTO sf_users(id,status) VALUES('audit-admin','active')");
  await owner.query("INSERT INTO sf_users(id,status,display_name) VALUES('audit-webhook-owner','active','Webhook owner')");
  await owner.query(`INSERT INTO sf_users(id,status,email_encrypted,email_lookup_hash)
    VALUES($1,'active',$2,$3)`,
  [blockedAccountId, encryptSensitiveData(blockedAccountEmail, "user-email"),
    createSensitiveDataLookupIndex(blockedAccountEmail, "user-email")]);
  await owner.query(`INSERT INTO sf_customer_credentials
    (user_id,password_hash,privacy_accepted_at,privacy_policy_version)
    VALUES($1,$2,now(),'isolated-account-block-test')`,
  [blockedAccountId, await hashCustomerSecret(blockedAccountPassword)]);
  const blockedAccountSessionToken = randomBytes(32).toString("base64url");
  await owner.query(`INSERT INTO sf_customer_sessions(user_id,token_hash,expires_at,pin_verified_until)
    VALUES($1,$2,now()+interval '1 hour',now()+interval '10 minutes')`,
  [blockedAccountId, hashCustomerSessionToken(blockedAccountSessionToken)]);
  for (const [kind, status, amount, fee] of [
    ["deposit", "succeeded", 10000, 300],
    ["international", "succeeded", 5500, 250],
    ["inter-network", "succeeded", 4000, 175],
    ["deposit", "failed", 7000, 500],
    ["deposit", "pending", 2500, 100],
  ]) {
    const inserted = await owner.query(`INSERT INTO sf_transactions
      (user_id,kind,status,sender_phone,recipient_phone,amount_minor,fee_minor,reference,idempotency_key)
      VALUES('audit-webhook-owner',$1,$2,'fixture-sender','fixture-recipient',$3,$4,$5,$6)
      RETURNING id`,
    [kind, status, amount, fee, randomBytes(16).toString("hex"), randomBytes(16).toString("hex")]);
    if (kind === "deposit" && status === "pending") traceTransactionId = inserted.rows[0].id;
  }
  await owner.query(`INSERT INTO sf_payment_aggregators(code,name,enabled,created_by,updated_by)
    VALUES('trace-fixture','Trace fixture',false,'audit-admin','audit-admin')
    ON CONFLICT (code) DO NOTHING`);
  await owner.query(`INSERT INTO sf_countries
    (country_code,country_name,phone_prefix,min_phone_digits,max_phone_digits,signup_enabled,created_by,updated_by)
    VALUES('ci','Côte d’Ivoire','+225',8,10,true,'audit-admin','audit-admin')
    ON CONFLICT (country_code) DO NOTHING`);
  const intent = await owner.query(`INSERT INTO sf_payment_intents
    (transaction_id,provider_code,request_hash,kind,currency,amount_minor,fee_minor,fee_payer,
     sender_total_minor,recipient_total_minor,state)
    SELECT id,'trace-fixture',$1,'deposit','XOF',2500,100,'recipient',2500,2400,'created'
    FROM sf_transactions WHERE id=$2 RETURNING id`,
  [randomBytes(32).toString("hex"), traceTransactionId]);
  const paymentLink = await owner.query(`INSERT INTO sf_customer_payment_links
    (user_id,public_token,idempotency_key,request_hash,currency,amount_minor,link_name,description,
     payment_method,source,status)
    VALUES('audit-webhook-owner',$1,$2,$3,'XOF',2500,'API trace fixture','Test de traçabilité',
      'mobile_money','api','active') RETURNING id`,
  [randomBytes(32).toString("base64url"), randomUUID(), randomBytes(32).toString("hex")]);
  const publicKey = `sfpk_test_${randomBytes(32).toString("base64url")}`;
  const apiKey = await owner.query(`INSERT INTO sf_developer_api_keys
    (user_id,label,public_key,public_key_prefix,public_key_hash,secret_key_prefix,secret_key_hash,status)
    VALUES('audit-webhook-owner','Trace fixture',$1,$2,$3,'sfsk_test_fixture',$4,'active')
    RETURNING id`,
  [publicKey, publicKey.slice(0, 20), randomBytes(32).toString("hex"), randomBytes(32).toString("hex")]);
  await owner.query(`INSERT INTO sf_developer_payment_sessions
    (user_id,api_key_id,payment_link_id,idempotency_key,merchant_reference,request_hash,
     client_token_hash,client_token_encrypted,mode,amount_minor,currency,metadata_encrypted,expires_at)
    VALUES('audit-webhook-owner',$1,$2,$3,'TRACE-ORDER-001',$4,$5,$6,'hosted',2500,'XOF',$7,now()+interval '10 minutes')`,
  [apiKey.rows[0].id, paymentLink.rows[0].id, randomUUID(), randomBytes(32).toString("hex"),
    randomBytes(32).toString("hex"), encryptSensitiveData("fixture-client-token", "developer-client-token"),
    encryptSensitiveData("{}", "developer-session-metadata")]);
  await owner.query(`INSERT INTO sf_customer_payment_link_payments
    (payment_link_id,intent_id,idempotency_key,request_hash,poll_token_hash,merchant_name,
     payer_first_name_encrypted,payer_last_name_encrypted)
    VALUES($1,$2,$3,$4,$5,'SendFlow fixture',$6,$7)`,
  [paymentLink.rows[0].id, intent.rows[0].id, randomUUID(), randomBytes(32).toString("hex"),
    randomBytes(32).toString("hex"), encryptSensitiveData("Test", "linkflow-payer-name"),
    encryptSensitiveData("User", "linkflow-payer-name")]);
  const attempt = await owner.query(`INSERT INTO sf_payment_attempts
    (intent_id,direction,country_code,channel_id,operation_reference,amount_minor,currency,status)
    VALUES($1,'payin','ci','mobile-money-ci',$2,2500,'XOF','prepared') RETURNING id`,
  [intent.rows[0].id, randomBytes(12).toString("hex").toUpperCase()]);
  await owner.query("UPDATE sf_payment_attempts SET status='dispatching' WHERE id=$1", [attempt.rows[0].id]);
  const providerReferenceHash = randomBytes(32).toString("hex");
  await owner.query(`UPDATE sf_payment_attempts
    SET status='pending',provider_reference=$2,provider_reference_hash=$3
    WHERE id=$1`,
  [attempt.rows[0].id, encryptSensitiveData("fixture-provider-reference", "provider-reference"), providerReferenceHash]);
  await owner.query(`INSERT INTO sf_payment_confirmations
    (attempt_id,event_fingerprint,source,provider_status,provider_reference_hash,amount_minor,currency,
     encrypted_payload,verified_at)
    VALUES($1,$2,'provider_status','pending',$3,2500,'XOF',$4,now())`,
  [attempt.rows[0].id, randomBytes(32).toString("hex"), providerReferenceHash,
    encryptSensitiveData(JSON.stringify({ fixture: true }), "payment-confirmation-payload")]);
  for (const [label, url, status, createdOffset] of [
    ["Production endpoint", "https://merchant.example/hooks/sendflow?source=primary", "active", 0],
    ["Old endpoint", "https://archive.example/hooks/sendflow", "revoked", 1],
  ]) {
    await owner.query(`INSERT INTO sf_developer_webhook_endpoints
      (user_id,label,url_encrypted,events,signing_secret_encrypted,status,created_at,revoked_at)
      VALUES('audit-webhook-owner',$1,$2,$3,$4,$5,now()-($6::int * interval '1 day'),
        CASE WHEN $5::varchar='revoked' THEN now()-interval '1 hour' ELSE NULL END)`,
    [label, encryptSensitiveData(url, "developer-webhook-url"),
      ["payment.succeeded", "payment.failed"],
      encryptSensitiveData("fixture-signing-secret", "developer-webhook-secret"),
      status, createdOffset]);
  }
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  writeFileSync(join(siteRoot, "index.html"), "<!doctype html><html><body>SPA fixture</body></html>");
  site = createSiteServer(siteRoot, async () => true, async () => "allowed");
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
  for (const category of ["admin", "customer", "authentication", "webhook", "public-read", "versioned-api"]) {
    assert.ok(routes.some((route) => route.category === category), category);
  }
  console.info(JSON.stringify({ routeInventory: routes.length,
    categories: Object.fromEntries([...new Set(routes.map((r) => r.category))]
      .map((key) => [key, routes.filter((r) => r.category === key).length])) }));
});

for (const route of routes.filter((r) => ["admin", "customer"].includes(r.category))) {
  const isAccessEndpoint = route.category === "admin"
    && ["/access", "/sign-in", "/sign-out"].some((p) => route.path === `/api${adminPrefix}${p}`);
  test(`${route.method} ${route.path} refuses anonymous sensitive access`, async () => {
    const response = await request(route.path, { method: route.method });
    if (isAccessEndpoint) {
      // The access bootstrap is deliberately public; an empty sign-in never authenticates.
      assert.ok([200, 400, 401, 403, 204].includes(response.status));
      if (response.status === 200) {
        const body = JSON.parse(response.text);
        assert.equal(body.isAdmin, false);
        assert.equal(body.sessionAuthenticated, false);
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

for (const route of routes.filter((r) => r.method !== "GET"
  && !["webhook", "versioned-api"].includes(r.category))) {
  test(`${route.method} ${route.path} blocks missing and foreign origins`, async () => {
    for (const origin of [null, "https://untrusted.invalid"]) {
      const response = await request(route.path, { method: route.method, origin });
      assert.equal(response.status, 403, response.text);
      assert.match(response.headers["cache-control"], /no-store/);
    }
  });
}

for (const route of routes.filter((r) => r.category === "versioned-api")) {
  test(`${route.method} ${route.path} uses API credentials instead of browser CSRF`, async () => {
    const response = await request(route.path, { method: route.method, origin: null });
    assert.ok([400, 401, 404, 503].includes(response.status), response.text);
    assert.notEqual(JSON.parse(response.text).code, "csrf_token_invalid");
    assert.doesNotMatch(response.text, /postgres(?:ql)?:\/\/|scrypt\$v1|BEGIN (?:RSA )?PRIVATE KEY|stackTrace/i);
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
      : route.path.includes("/public/payment-links/") && route.path.includes("/quote/") ? 400
      : route.path.includes("/public/payment-links/") || route.path.includes("/public/payment-link-attempts/") ? 404
      : 200;
    assert.equal(response.status, expected, response.text);
    assert.doesNotMatch(response.text, /postgres(?:ql)?:\/\/|scrypt\$v1|BEGIN (?:RSA )?PRIVATE KEY|stackTrace/i);
    assert.ok((response.headers["set-cookie"] ?? [])
      .some((cookie) => cookie.startsWith("__Host-sendflow_csrf=")));
  });
}

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

test("client role claims cannot suspend customer accounts", async () => {
  const csrfBootstrap = await request("/api/auth/session");
  const csrfCookie = csrfBootstrap.headers["set-cookie"]
    ?.find((cookie) => cookie.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  assert.ok(csrfCookie);
  assert.ok(csrfBootstrap.headers["x-csrf-token"]);
  const response = await request(`/api${adminPrefix}/users/${blockedAccountId}/suspend`, {
    method: "POST",
    headers: {
      Cookie: csrfCookie,
      "X-CSRF-Token": csrfBootstrap.headers["x-csrf-token"],
      "x-admin-role": "owner",
    },
    rawBody: JSON.stringify({ reason: "Legacy access denial fixture.", confirmation: "CONFIRMER" }),
  });
  assert.equal(response.status, 401, response.text);
  assert.equal(
    (await owner.query("SELECT status FROM sf_users WHERE id=$1", [blockedAccountId])).rows[0].status,
    "active",
  );
  const customerCsrf = await request("/api/auth/session");
  const customerCookie = customerCsrf.headers["set-cookie"]
    ?.find((cookie) => cookie.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  const login = await request("/api/auth/sign-in", {
    method: "POST",
    headers: { Cookie: customerCookie, "X-CSRF-Token": customerCsrf.headers["x-csrf-token"] },
    rawBody: JSON.stringify({
      email: blockedAccountEmail,
      password: blockedAccountPassword,
      turnstileToken: createTurnstileTestToken("login"),
    }),
  });
  assert.equal(login.status, 200, login.text);
});

test("legacy administrator cookies cannot read transaction payment traces", async () => {
  const response = await request(`/api${adminPrefix}/transactions/${traceTransactionId}`, {
    headers: legacyAdminHeaders(),
  });
  assert.equal(response.status, 401, response.text);
  assert.doesNotMatch(response.text, /TRACE-ORDER-001|public_token|pollTokenHash|idempotencyKey|clientToken/i);
});

test("legacy administrator cookies cannot enumerate transaction filters", async () => {
  const response = await request(
    `/api${adminPrefix}/transactions?countryCode=ci&channelId=mobile-money-ci&paymentSource=api&integrationMode=hosted&page=1&pageSize=1`,
    { headers: legacyAdminHeaders() },
  );
  assert.equal(response.status, 401, response.text);
  assert.doesNotMatch(response.text, /TRACE-ORDER-001|fixture-recipient/i);
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

test("frontend origin refuses hidden files, old panel paths, source maps, API fallbacks and mutations", async () => {
  for (const path of [
    "/.env",
    "/assets/private.js.map",
    "/api/not-a-page",
    "/%2eenv",
    "/admin",
    "/admin/sign-in",
  ]) {
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
  for (const path of ["/api/unknown-route", "/api/webhooks/identity-provider"]) {
    const read = await request(path);
    assert.equal(read.status, 404);
    const write = await request(path, { method: "POST", origin: null });
    assert.equal(write.status, 403);
    assert.doesNotMatch(read.text, /Error:|node_modules|postgresql:/);
  }
});

test("legacy admin cookies and client role claims cannot access protected profile or pricing routes", async () => {
  for (const path of [
    `/api${adminPrefix}/operator-pricing`,
    `/api${adminPrefix}/users`,
    `/api${adminPrefix}/users/audit-webhook-owner`,
    `/api${adminPrefix}/developer-webhooks?userId=audit-webhook-owner`,
  ]) {
    const response = await request(path, { headers: legacyAdminHeaders() });
    assert.equal(response.status, 401, response.text);
    assert.doesNotMatch(response.text, /financialTotals|signingSecret|fixture-signing-secret/i);
  }
});

test("valid CSRF alone cannot authorize an administrative mutation", async () => {
  const bootstrap = await request("/api/auth/session");
  assert.ok(bootstrap.headers["x-csrf-token"]);
  const csrfCookie = bootstrap.headers["set-cookie"]
    ?.find((cookie) => cookie.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  assert.ok(csrfCookie);
  const before = await pool.query("SELECT count(*)::int AS n FROM sf_admin_audit_logs");
  const response = await request(`/api${adminPrefix}/operator-pricing-rates`, {
    method: "PUT",
    headers: {
      Cookie: csrfCookie,
      "X-CSRF-Token": bootstrap.headers["x-csrf-token"],
    },
  });
  assert.equal(response.status, 401, response.text);
  const after = await pool.query("SELECT count(*)::int AS n FROM sf_admin_audit_logs");
  assert.equal(after.rows[0].n, before.rows[0].n);
});

test("client role flags do not authorize administrative mutations", async () => {
  const bootstrap = await request("/api/auth/session");
  const csrfCookie = bootstrap.headers["set-cookie"]
    ?.find((cookie) => cookie.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  assert.ok(csrfCookie);
  const response = await request(`/api${adminPrefix}/operator-pricing-rates`, {
    method: "PUT",
    headers: {
      Cookie: csrfCookie,
      "X-CSRF-Token": bootstrap.headers["x-csrf-token"],
      "x-admin-role": "super-admin",
    },
  });
  assert.equal(response.status, 401, response.text);
});
