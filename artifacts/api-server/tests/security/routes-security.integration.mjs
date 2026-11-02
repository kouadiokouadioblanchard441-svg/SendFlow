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
  hashAdminSessionToken,
  hashCustomerSessionToken,
  ADMIN_SESSION_COOKIE,
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
  await owner.query("INSERT INTO sf_registration_settings(id) VALUES('signup')");
  await owner.query(
    "INSERT INTO sf_customer_service_settings(id) VALUES('global') ON CONFLICT (id) DO NOTHING",
  );
  await owner.query("INSERT INTO sf_users(id,status) VALUES('audit-admin','active')");
  await owner.query("INSERT INTO sf_admin_grants(user_id,can_mutate,pin_hash) VALUES('audit-admin',true,$1)",
    [await hashCustomerSecret(randomBytes(16).toString("hex"))]);
  await owner.query("INSERT INTO sf_users(id,status) VALUES('audit-readonly-admin','active')");
  await owner.query("INSERT INTO sf_admin_grants(user_id,can_mutate,pin_hash) VALUES('audit-readonly-admin',false,$1)",
    [await hashCustomerSecret(randomBytes(16).toString("hex"))]);
  await owner.query(`INSERT INTO sf_admin_sessions(user_id,authorization_version,token_hash,expires_at,pin_verified_until)
    SELECT user_id,authorization_version,$1,now()+interval '1 hour',now()+interval '10 minutes'
    FROM sf_admin_grants WHERE user_id='audit-admin'`,
  [hashAdminSessionToken(adminToken)]);
  await owner.query(`INSERT INTO sf_admin_sessions(user_id,authorization_version,token_hash,expires_at,pin_verified_until)
    SELECT user_id,authorization_version,$1,now()+interval '1 hour',now()+interval '10 minutes'
    FROM sf_admin_grants WHERE user_id='audit-readonly-admin'`,
  [hashAdminSessionToken(readOnlyAdminToken)]);
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
    (country_code,country_name,phone_prefix,min_phone_digits,max_phone_digits,created_by,updated_by)
    VALUES('ci','Côte d’Ivoire','+225',8,10,'audit-admin','audit-admin')
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

test("administrator can block and unblock an account and blocked sign-in directs valid credentials to support", async () => {
  const readOnlyCsrfBootstrap = await request("/api/auth/session", {
    headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${readOnlyAdminToken}` },
  });
  assert.ok(readOnlyCsrfBootstrap.headers["x-csrf-token"]);
  const readOnlyMutation = await request(`/api${adminPrefix}/users/${blockedAccountId}/suspend`, {
    method: "POST",
    headers: {
      Cookie: `${ADMIN_SESSION_COOKIE}=${readOnlyAdminToken}`,
      "X-CSRF-Token": readOnlyCsrfBootstrap.headers["x-csrf-token"],
    },
    rawBody: JSON.stringify({
      reason: "Tentative non autorisée de test.",
      confirmation: "CONFIRMER",
    }),
  });
  assert.equal(readOnlyMutation.status, 403, readOnlyMutation.text);
  assert.equal((await owner.query("SELECT status FROM sf_users WHERE id=$1", [blockedAccountId])).rows[0].status, "active");

  const csrfBootstrap = await request("/api/auth/session", {
    headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` },
  });
  assert.ok(csrfBootstrap.headers["x-csrf-token"]);
  const adminMutationHeaders = {
    Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}`,
    "X-CSRF-Token": csrfBootstrap.headers["x-csrf-token"],
  };
  const block = await request(`/api${adminPrefix}/users/${blockedAccountId}/suspend`, {
    method: "POST",
    headers: adminMutationHeaders,
    rawBody: JSON.stringify({
      reason: "Motif de blocage de test isolé.",
      confirmation: "CONFIRMER",
    }),
  });
  assert.equal(block.status, 200, block.text);
  assert.equal(JSON.parse(block.text).status, "suspended");
  const storedBlocked = await owner.query(
    "SELECT status,suspension_reason FROM sf_users WHERE id=$1",
    [blockedAccountId],
  );
  assert.equal(storedBlocked.rows[0].status, "suspended");
  assert.equal(storedBlocked.rows[0].suspension_reason, "Motif de blocage de test isolé.");
  const revokedSession = await owner.query(
    "SELECT revoked_at FROM sf_customer_sessions WHERE user_id=$1",
    [blockedAccountId],
  );
  assert.ok(revokedSession.rows[0].revoked_at);

  const customerCsrfBootstrap = await request("/api/auth/session");
  const customerCsrfCookie = customerCsrfBootstrap.headers["set-cookie"]
    ?.find((cookie) => cookie.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  assert.ok(customerCsrfCookie);
  assert.ok(customerCsrfBootstrap.headers["x-csrf-token"]);
  const customerSignInHeaders = {
    Cookie: customerCsrfCookie,
    "X-CSRF-Token": customerCsrfBootstrap.headers["x-csrf-token"],
  };
  const blockedLogin = await request("/api/auth/sign-in", {
    method: "POST",
    headers: customerSignInHeaders,
    rawBody: JSON.stringify({
      email: blockedAccountEmail,
      password: blockedAccountPassword,
      turnstileToken: createTurnstileTestToken("login"),
    }),
  });
  assert.equal(blockedLogin.status, 423, blockedLogin.text);
  assert.match(blockedLogin.text, /compte est bloqué.*contacter le support SendFlow/i);
  const invalidBlockedLogin = await request("/api/auth/sign-in", {
    method: "POST",
    headers: customerSignInHeaders,
    rawBody: JSON.stringify({
      email: blockedAccountEmail,
      password: "wrong-password-for-test",
      turnstileToken: createTurnstileTestToken("login"),
    }),
  });
  assert.equal(invalidBlockedLogin.status, 401, invalidBlockedLogin.text);
  assert.doesNotMatch(invalidBlockedLogin.text, /compte est bloqué/i);

  const restore = await request(`/api${adminPrefix}/users/${blockedAccountId}/restore`, {
    method: "POST",
    headers: adminMutationHeaders,
    rawBody: JSON.stringify({
      reason: "Fin du blocage de test isolé.",
      confirmation: "CONFIRMER",
    }),
  });
  assert.equal(restore.status, 200, restore.text);
  assert.equal(JSON.parse(restore.text).status, "active");
  const storedRestored = await owner.query(
    "SELECT status,suspended_at,suspended_by,suspension_reason FROM sf_users WHERE id=$1",
    [blockedAccountId],
  );
  assert.deepEqual(storedRestored.rows[0], {
    status: "active",
    suspended_at: null,
    suspended_by: null,
    suspension_reason: null,
  });
  const unblockedLogin = await request("/api/auth/sign-in", {
    method: "POST",
    headers: customerSignInHeaders,
    rawBody: JSON.stringify({
      email: blockedAccountEmail,
      password: blockedAccountPassword,
      turnstileToken: createTurnstileTestToken("login"),
    }),
  });
  assert.equal(unblockedLogin.status, 200, unblockedLogin.text);
});

test("admin transaction detail returns persisted payment trace without link secrets", async () => {
  const response = await request(`/api${adminPrefix}/transactions/${traceTransactionId}`, {
    headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` },
  });
  assert.equal(response.status, 200, response.text);
  const detail = JSON.parse(response.text);
  assert.equal(detail.kind, "deposit");
  assert.equal(detail.paymentTrace.intent.kind, "deposit");
  assert.equal(detail.paymentTrace.paymentLink.source, "api");
  assert.equal(detail.paymentTrace.paymentLink.paymentMethod, "mobile_money");
  assert.equal(detail.paymentTrace.integrationSession.mode, "hosted");
  assert.equal(detail.paymentTrace.integrationSession.merchantReference, "TRACE-ORDER-001");
  assert.equal(detail.paymentTrace.attempts.length, 1);
  assert.equal(detail.paymentTrace.attempts[0].countryCode, "ci");
  assert.equal(typeof detail.paymentTrace.attempts[0].countryName, "string");
  assert.ok(detail.paymentTrace.attempts[0].countryName.length > 0);
  assert.equal(detail.paymentTrace.attempts[0].channelId, "mobile-money-ci");
  assert.equal(detail.paymentTrace.attempts[0].status, "pending");
  assert.equal(detail.paymentTrace.attempts[0].confirmations.length, 1);
  assert.equal(detail.paymentTrace.attempts[0].confirmations[0].source, "provider_status");
  assert.equal(detail.paymentTrace.attempts[0].confirmations[0].providerStatus, "pending");
  assert.equal(detail.paymentTrace.attempts[0].confirmations[0].amountMinor, 2500);
  assert.equal("encryptedPayload" in detail.paymentTrace.attempts[0].confirmations[0], false);
  assert.equal("eventFingerprint" in detail.paymentTrace.attempts[0].confirmations[0], false);
  assert.equal("providerReferenceHash" in detail.paymentTrace.attempts[0].confirmations[0], false);
  assert.doesNotMatch(response.text, /public_token|pollTokenHash|idempotencyKey|clientToken|sfenc-v1\./i);
});

test("admin transaction filters apply country, channel, source and integration mode before pagination", async () => {
  const response = await request(
    `/api${adminPrefix}/transactions?countryCode=ci&channelId=mobile-money-ci&paymentSource=api&integrationMode=hosted&page=1&pageSize=1`,
    { headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` } },
  );
  assert.equal(response.status, 200, response.text);
  const page = JSON.parse(response.text);
  assert.equal(page.total, 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, traceTransactionId);
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
  for (const path of ["/api/unknown-route", "/api/webhooks/identity-provider"]) {
    const read = await request(path);
    assert.equal(read.status, 404);
    const write = await request(path, { method: "POST", origin: null });
    assert.equal(write.status, 403);
    assert.doesNotMatch(read.text, /Error:|node_modules|postgresql:/);
  }
});

test("full mounted admin router allows read-only user profiles and rejects unrelated scope escalation", async () => {
  const headers = { Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` };
  const allowed = await request(`/api${adminPrefix}/operator-pricing`, { headers });
  assert.equal(allowed.status, 200, allowed.text);
  for (const path of ["/overview", "/network-defense", "/ip-blocklist"]) {
    const blocked = await request(`/api${adminPrefix}${path}`, { headers });
    assert.equal(blocked.status, 403, blocked.text);
  }
  assert.equal((await request(`/api${adminPrefix}/users`, { headers })).status, 200);
  assert.equal((await request(`/api${adminPrefix}/users/audit-webhook-owner`, { headers })).status, 200);
  await owner.query("UPDATE sf_admin_grants SET can_mutate=false WHERE user_id='audit-admin'");
  assert.equal((await request(`/api${adminPrefix}/users/audit-webhook-owner`, { headers })).status, 200);
  await owner.query("UPDATE sf_admin_grants SET can_mutate=true WHERE user_id='audit-admin'");
  const forged = await request(`/api${adminPrefix}/operator-pricing`, {
    headers: { Cookie: `__Host-sendflow_session=${adminToken}`, "x-admin-role": "owner" },
  });
  assert.equal(forged.status, 401);
});

test("admin user profile shows financial totals and every paginated webhook without signing secrets", async () => {
  const headers = { Cookie: `${ADMIN_SESSION_COOKIE}=${adminToken}` };
  const profileResponse = await request(`/api${adminPrefix}/users/audit-webhook-owner`, { headers });
  assert.equal(profileResponse.status, 200, profileResponse.text);
  const profile = JSON.parse(profileResponse.text);
  assert.equal(profile.financialTotals.currency, "XOF");
  assert.equal(profile.financialTotals.depositsMinor, 10000);
  assert.equal(profile.financialTotals.internationalPayoutsMinor, 5500);
  assert.deepEqual(profile.financialTotals.feesByKind, {
    depositMinor: 300,
    interNetworkMinor: 175,
    internationalMinor: 250,
  });

  const pageOne = await request(`/api${adminPrefix}/developer-webhooks?userId=audit-webhook-owner&page=1&pageSize=1`, { headers });
  const pageTwo = await request(`/api${adminPrefix}/developer-webhooks?userId=audit-webhook-owner&page=2&pageSize=1`, { headers });
  assert.equal(pageOne.status, 200, pageOne.text);
  assert.equal(pageTwo.status, 200, pageTwo.text);
  const firstPage = JSON.parse(pageOne.text);
  const secondPage = JSON.parse(pageTwo.text);
  assert.equal(firstPage.total, 2);
  assert.equal(firstPage.items.length, 1);
  assert.equal(secondPage.items.length, 1);
  assert.deepEqual(
    new Set([...firstPage.items, ...secondPage.items].map(({ status }) => status)),
    new Set(["active", "revoked"]),
  );
  const serializedEndpoints = JSON.stringify([firstPage, secondPage]);
  assert.match(serializedEndpoints, /https:\/\/(?:merchant|archive)\.example\/hooks\/sendflow/);
  assert.doesNotMatch(serializedEndpoints, /fixture-signing-secret|signingSecretEncrypted|signingSecret/);

  const audit = await pool.query(`SELECT count(*)::int AS n FROM sf_admin_audit_logs
    WHERE admin_user_id='audit-admin' AND action='view_developer_webhooks'
      AND resource_type='developer_webhook' AND resource_id='audit-webhook-owner'`);
  assert.equal(audit.rows[0].n, 2);
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
  assert.equal((await request(`/api${adminPrefix}/users/audit-webhook-owner`, { headers })).status, 403);
  await owner.query("UPDATE sf_admin_sessions SET pin_verified_until=now()+interval '10 minutes' WHERE user_id='audit-admin'");
  await owner.query("UPDATE sf_admin_grants SET can_mutate=false WHERE user_id='audit-admin'");
  // Grant mutations may revoke this session; neither rejection may reach a handler.
  const denied = await request(`/api${adminPrefix}/operator-pricing-rates`, {
    method: "PUT", headers,
  });
  assert.ok([401, 403].includes(denied.status), denied.text);
});
