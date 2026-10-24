import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { createHmac, randomBytes, randomUUID, randomInt } from "node:crypto";
import http from "node:http";
import pg from "pg";
import "./ip-blocklist.integration.mjs";
import "./network-defense.integration.mjs";

const runtimePath = process.env.SENDFLOW_ISOLATED_RUNTIME;
const socket = process.env.SENDFLOW_FIXTURE_SOCKET;
if (!runtimePath?.includes("/sendflow-isolated-finance-") || !socket?.includes("/sendflow-isolated-finance-")) {
  throw new Error("Run via run-isolated-finance.mjs; a disposable database is mandatory");
}
let externalCalls = 0;
globalThis.fetch = async () => { externalCalls++; throw new Error("External network is forbidden in this suite"); };
const runtime = createRequire(import.meta.url)(runtimePath);
const owner = new pg.Pool({ host: socket, port: 15432, database: "postgres", user: "sf_fixture_owner" });
const { pool, executeAdminWalletAdjustment, consumeTransferQuoteQuota } = runtime;
const tokens = {}, transactions = {};
let server, logoServer;

before(async () => {
  for (const id of ["fixture-a", "fixture-b", "fixture-wallet"]) {
    await owner.query("INSERT INTO sf_users(id,status,display_name) VALUES($1,'active',$2)", [id, id]);
    await owner.query("INSERT INTO sf_wallets(user_id,balance_minor) VALUES($1,100)", [id]);
    await owner.query(`INSERT INTO sf_customer_credentials
      (user_id,password_hash,pin_hash,privacy_accepted_at,privacy_policy_version)
      VALUES($1,'fixture-unused-hash','fixture-unused-pin',now(),'fixture')`, [id]);
    tokens[id] = randomBytes(32).toString("base64url");
    await owner.query(`INSERT INTO sf_customer_sessions(user_id,token_hash,expires_at,pin_verified_until)
      VALUES($1,$2,now()+interval '1 hour',now()+interval '15 minutes')`,
    [id, runtime.hashCustomerSessionToken(tokens[id])]);
    const tx = await owner.query(`INSERT INTO sf_transactions
      (user_id,kind,status,sender_phone,recipient_phone,amount_minor,reference,idempotency_key)
      VALUES($1,'international','pending','fixture-origin','fixture-destination',10,$2,$3) RETURNING id`,
    [id, randomUUID(), randomUUID()]);
    transactions[id] = tx.rows[0].id;
  }
  // Configuration activation is explicit and restricted to this disposable cluster.
  await owner.query(`UPDATE sf_countries SET deposit_enabled=true,
    inter_network_enabled=true, international_enabled=true WHERE country_code='ci'`);
  for (const id of ["fixture-source", "fixture-destination"]) {
    await owner.query(`INSERT INTO sf_operator_catalog
      (operator_id,country_code,name,short_name,initials,brand,enabled,
       deposit_enabled,inter_network_enabled,international_enabled,created_by,updated_by)
      VALUES($1,'ci','Fixture operator','Fixture','FX','generic',true,true,true,true,'fixture','fixture')`, [id]);
  }
  await owner.query(`INSERT INTO sf_operator_pricing_rates
    (operator_id,country_code,category_id,fee_percent,version,created_by,updated_by)
    VALUES('fixture-source','ci','inter-network',2,1,'fixture','fixture'),
      ('fixture-source','ci','deposit',1.25,2,'fixture','fixture'),
      ('fixture-destination','ci','international',1.8,3,'fixture','fixture')`);
  const logoApp = runtime.express();
  logoApp.use("/api", runtime.operatorPricingRouter);
  logoApp.use("/api/DMgrgmt-1np5g23g12bGFtMwh", runtime.createAdminOperatorLogoRoutes((req, res) => {
    if (req.get("x-fixture-admin") === "authorized") return "fixture-admin";
    res.status(403).json({ error: "Fixture administrator required" });
    return null;
  }));
  logoApp.use((error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(error?.status === 413 ? 413 : 400).json({
      error: error?.status === 413 ? "Logo exceeds 512 KiB" : "Invalid logo request",
    });
  });
  logoServer = logoApp.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    logoServer.once("listening", resolve);
    logoServer.once("error", reject);
  });
  server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (logoServer) await new Promise((resolve) => logoServer.close(resolve));
  await pool.end();
  await owner.end();
});

function rawRequest(path, { method = "GET", user, body, rawBody, headers = {} } = {}) {
  const data = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1", port: server.address().port, path, method,
      headers: { Origin: "https://sendflow-test.invalid",
        ...(user ? { Cookie: `__Host-sendflow_session=${tokens[user]}` } : {}),
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        ...headers },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8"); res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on("error", reject); req.end(data);
  });
}

function headerValue(headers, name) {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

async function request(path, options = {}) {
  const { method = "GET", user, headers = {} } = options;
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
    || path === "/api/webhooks/didit") {
    return rawRequest(path, options);
  }

  const suppliedCookie = headerValue(headers, "cookie")
    ?? (user ? `__Host-sendflow_session=${tokens[user]}` : undefined);
  const suppliedOrigin = headerValue(headers, "origin") ?? "https://sendflow-test.invalid";
  const bootstrap = await rawRequest("/api/auth/session", {
    method: "GET",
    headers: {
      Origin: suppliedOrigin,
      ...(suppliedCookie ? { Cookie: suppliedCookie } : {}),
    },
  });
  const csrfToken = bootstrap.headers["x-csrf-token"];
  if (typeof csrfToken !== "string") {
    throw new Error("The isolated API did not issue a CSRF token");
  }

  const csrfCookie = (bootstrap.headers["set-cookie"] ?? [])
    .find((cookie) => cookie.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  const cookieParts = [suppliedCookie, csrfCookie].filter(Boolean);
  const requestHeaders = { ...headers };
  for (const key of Object.keys(requestHeaders)) {
    if (["cookie", "x-csrf-token"].includes(key.toLowerCase())) delete requestHeaders[key];
  }
  requestHeaders.Cookie = cookieParts.join("; ");
  requestHeaders["X-CSRF-Token"] = csrfToken;
  return rawRequest(path, { ...options, headers: requestHeaders });
}

function logoRequest(path, { method = "GET", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: logoServer.address().port,
      path,
      method,
      headers: {
        ...(body ? { "Content-Length": body.length } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("operator logos validate, store bytes in Neon, use version checks, and serve safely from the public catalog", async () => {
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082",
    "hex",
  );
  const adminPrefix = "/api/DMgrgmt-1np5g23g12bGFtMwh/operators/fixture-source/logo";
  const response = await logoRequest(`${adminPrefix}/1`, {
    method: "PUT",
    body: png,
    headers: {
      "Content-Type": "image/png",
      Origin: "https://sendflow-test.invalid",
      "X-Fixture-Admin": "authorized",
    },
  });
  assert.equal(response.status, 200);
  const managed = JSON.parse(response.body.toString("utf8"));
  assert.equal(managed.logoUrl, "/api/operators/fixture-source/logo?v=2");

  const stored = await owner.query(
    "SELECT logo_data, logo_content_type, version FROM sf_operator_catalog WHERE operator_id='fixture-source'",
  );
  assert.deepEqual(stored.rows[0].logo_data, png);
  assert.equal(stored.rows[0].logo_content_type, "image/png");
  assert.equal(stored.rows[0].version, 2);

  const pricingResponse = await logoRequest("/api/pricing");
  assert.equal(pricingResponse.status, 200);
  const pricing = JSON.parse(pricingResponse.body.toString("utf8"));
  const sourceOperator = pricing.operators.find((item) => item.id === "fixture-source");
  assert.equal(sourceOperator.logoUrl, managed.logoUrl);
  assert.equal(sourceOperator.fees.deposit, 0.0125);
  assert.equal(pricingResponse.body.includes(png.toString("base64")), false);

  const publicLogo = await logoRequest(managed.logoUrl);
  assert.equal(publicLogo.status, 200);
  assert.equal(publicLogo.headers["content-type"], "image/png");
  assert.equal(publicLogo.headers["x-content-type-options"], "nosniff");
  assert.deepEqual(publicLogo.body, png);
  const cachedLogo = await logoRequest(managed.logoUrl, {
    headers: { "If-None-Match": publicLogo.headers.etag },
  });
  assert.equal(cachedLogo.status, 304);

  const invalidImage = await logoRequest(`${adminPrefix}/2`, {
    method: "PUT",
    body: Buffer.from("not an image"),
    headers: {
      "Content-Type": "image/png",
      Origin: "https://sendflow-test.invalid",
      "X-Fixture-Admin": "authorized",
    },
  });
  assert.equal(invalidImage.status, 400);
  const unsupportedType = await logoRequest(`${adminPrefix}/2`, {
    method: "PUT",
    body: Buffer.from("<svg></svg>"),
    headers: {
      "Content-Type": "image/svg+xml",
      Origin: "https://sendflow-test.invalid",
      "X-Fixture-Admin": "authorized",
    },
  });
  assert.equal(unsupportedType.status, 415);
  const oversized = await logoRequest(`${adminPrefix}/2`, {
    method: "PUT",
    body: Buffer.alloc(512 * 1024 + 1, 0),
    headers: {
      "Content-Type": "image/png",
      Origin: "https://sendflow-test.invalid",
      "X-Fixture-Admin": "authorized",
    },
  });
  assert.equal(oversized.status, 413);
  const staleVersion = await logoRequest(`${adminPrefix}/1`, {
    method: "PUT",
    body: png,
    headers: {
      "Content-Type": "image/png",
      Origin: "https://sendflow-test.invalid",
      "X-Fixture-Admin": "authorized",
    },
  });
  assert.equal(staleVersion.status, 409);

  const removed = await logoRequest(`${adminPrefix}/2`, {
    method: "DELETE",
    headers: {
      Origin: "https://sendflow-test.invalid",
      "X-Fixture-Admin": "authorized",
    },
  });
  assert.equal(removed.status, 200);
  assert.equal(JSON.parse(removed.body.toString("utf8")).logoUrl, null);
  const removedImage = await logoRequest(managed.logoUrl);
  assert.equal(removedImage.status, 404);
  const audits = await owner.query(
    "SELECT count(*)::int AS count FROM sf_admin_audit_logs WHERE admin_user_id='fixture-admin' AND action='update_operator_logo'",
  );
  assert.equal(audits.rows[0].count, 2);

  const unauthorized = await request(`${adminPrefix}/3`, {
    method: "PUT",
    rawBody: png,
    headers: { "Content-Type": "image/png", Origin: "https://sendflow-test.invalid" },
  });
  assert.equal(unauthorized.status, 401);
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]));
  return value;
}
function webhook(body, signature, timestamp = String(body.timestamp ?? Math.floor(Date.now() / 1000))) {
  return request("/api/webhooks/didit", { method: "POST", body, headers: {
    "X-Timestamp": timestamp,
    "X-Signature-V2": signature ?? createHmac("sha256", process.env.DIDIT_WEBHOOK_SECRET)
      .update(JSON.stringify(canonical(body))).digest("hex"),
  } });
}
const adjustment = (extra = {}) => ({
  direction: "debit", amountMinor: 1, expectedBalanceMinor: 100,
  reason: "Isolated financial integrity test", idempotencyKey: randomUUID(), ...extra,
});

test("direct private API access requires server authentication; foreign transactions remain inaccessible", async () => {
  assert.equal((await request("/api/me")).status, 401);
  assert.equal((await request(`/api/me/transactions/${transactions["fixture-a"]}`, { user: "fixture-a" })).status, 200);
  assert.equal((await request(`/api/me/transactions/${transactions["fixture-b"]}`, { user: "fixture-a" })).status, 404);
  assert.equal((await request("/api/me/transfer-quote", { method: "POST", body: {} })).status, 401);
});
test("browser flags cannot unlock the administrator or forge a payment status", async () => {
  const before = await owner.query("SELECT status FROM sf_transactions WHERE id=$1", [transactions["fixture-a"]]);
  assert.equal((await request("/api/DMgrgmt-1np5g23g12bGFtMwh/overview", { user: "fixture-a" })).status, 401);
  assert.equal((await request(`/api/DMgrgmt-1np5g23g12bGFtMwh/users/fixture-a/wallet-adjustments`, {
    user: "fixture-a", method: "POST", body: { isAdmin: true, ...adjustment() },
    headers: { Origin: "https://sendflow-test.invalid" },
  })).status, 401);
  assert.equal((await request(`/api/me/transactions/${transactions["fixture-a"]}`, {
    user: "fixture-a", method: "PATCH", body: { status: "succeeded" },
  })).status, 404);
  assert.deepEqual((await owner.query("SELECT status FROM sf_transactions WHERE id=$1",
    [transactions["fixture-a"]])).rows, before.rows);
});
test("direct quotes ignore forged prices, reject limits and locked sessions, then enforce the HTTP quota", async () => {
  const body = { kind: "inter-network", amountMinor: 10_000, senderPaysFees: true,
    sourceOperatorId: "fixture-source", destinationOperatorId: "fixture-destination",
    senderPhone: "+2250000000000", recipientPhone: "+2250000000001",
    feeMinor: 0, totalDebitMinor: 1, userId: "fixture-b", status: "succeeded" };
  const quote = await request("/api/me/transfer-quote", { method: "POST", user: "fixture-a", body });
  assert.equal(quote.status, 200);
  assert.equal(JSON.parse(quote.text).feeMinor, 200);
  assert.equal(JSON.parse(quote.text).totalDebitMinor, 10_200);
  assert.equal((await request("/api/me/transfer-quote", { method: "POST", user: "fixture-a",
    body: { ...body, amountMinor: 150_001 } })).status, 409);
  await owner.query("UPDATE sf_customer_sessions SET pin_verified_until=NULL WHERE user_id='fixture-b'");
  assert.equal((await request("/api/me/transfer-quote", { method: "POST", user: "fixture-b", body })).status, 403);
  const attempts = await Promise.all(Array.from({ length: 65 }, () =>
    request("/api/me/transfer-quote", { method: "POST", user: "fixture-a", body })));
  assert.equal(attempts.filter((r) => r.status === 200).length, 58);
  assert.equal(attempts.filter((r) => r.status === 429).length, 7);
  assert.equal(attempts.find((r) => r.status === 429).headers["retry-after"], "60");
  assert.equal((await owner.query("SELECT count(*) FROM sf_transactions")).rows[0].count, "3");
  await owner.query("UPDATE sf_api_request_limits SET window_started_at=now()-interval '2 minutes'");
});
test("SQL row locks reject concurrent stale balances without a second debit", async () => {
  const results = await Promise.allSettled(Array.from({ length: 40 }, () =>
    executeAdminWalletAdjustment("fixture-admin", "fixture-wallet", adjustment())));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of results.filter((r) => r.status === "rejected")) assert.equal(r.reason.statusCode, 409);
  assert.equal(Number((await owner.query("SELECT balance_minor FROM sf_wallets WHERE user_id='fixture-wallet'")).rows[0].balance_minor), 99);
});
test("SQL idempotency and audit are atomic, including altered replays and rollback", async () => {
  const input = adjustment({ expectedBalanceMinor: 99, amountMinor: 2 });
  const results = await Promise.all(Array.from({ length: 40 }, () =>
    executeAdminWalletAdjustment("fixture-admin", "fixture-wallet", input)));
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.equal((await owner.query("SELECT count(*) FROM sf_wallet_ledger WHERE idempotency_key=$1",
    [input.idempotencyKey])).rows[0].count, "1");
  await assert.rejects(executeAdminWalletAdjustment("fixture-admin", "fixture-wallet",
    { ...input, amountMinor: 3 }), (e) => e.statusCode === 409);
  await owner.query("REVOKE INSERT ON sf_admin_audit_logs FROM sf_fixture_app");
  const rollback = adjustment({ expectedBalanceMinor: 97 });
  try {
    await assert.rejects(executeAdminWalletAdjustment("fixture-admin", "fixture-wallet", rollback));
    assert.equal((await owner.query("SELECT count(*) FROM sf_wallet_ledger WHERE idempotency_key=$1",
      [rollback.idempotencyKey])).rows[0].count, "0");
    assert.equal(Number((await owner.query("SELECT balance_minor FROM sf_wallets WHERE user_id='fixture-wallet'")).rows[0].balance_minor), 97);
  } finally { await owner.query("GRANT INSERT ON sf_admin_audit_logs TO sf_fixture_app"); }
});
test("SQL constraints and append-only triggers prevent alteration of financial history", async () => {
  await assert.rejects(owner.query("UPDATE sf_wallets SET balance_minor=-1 WHERE user_id='fixture-wallet'"), (e) => e.code === "23514");
  for (const table of ["sf_wallet_ledger", "sf_admin_audit_logs"]) {
    await assert.rejects(pool.query(`DELETE FROM ${table}`), (e) => e.code === "42501");
    await assert.rejects(owner.query(`DELETE FROM ${table}`), (e) => e.code === "23514");
    const field = table === "sf_wallet_ledger" ? "reason" : "action";
    await assert.rejects(owner.query(`UPDATE ${table} SET ${field}=${field}`), (e) => e.code === "23514");
    // Include referencing tables so the test reaches the append-only trigger,
    // rather than stopping earlier at PostgreSQL's FK/TRUNCATE protection.
    await assert.rejects(owner.query(`TRUNCATE ${table} CASCADE`), (e) => e.code === "23514");
  }
  const legacy = (await owner.query("SELECT payload_digest FROM sf_identity_webhook_events WHERE event_id='legacy-fixture'")).rows[0];
  assert.equal(legacy.payload_digest, null);
});
test("a historical approval cannot override the most recent verification", async () => {
  await owner.query(`INSERT INTO sf_identity_verifications(user_id,provider_session_id,vendor_data,verification_url,status,created_at)
    VALUES('fixture-b','fixture-old-approved','fixture-b','https://verify.didit.me/session/fixture','Approved',now()-interval '2 days'),
    ('fixture-b','fixture-latest-expired','fixture-b','https://verify.didit.me/session/fixture','Expired',now()-interval '1 day')`);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-b")).monthlyLimit, 150_000);
});
test("persistent quote quota is atomic across connections and resets after expiry", async () => {
  const results = await Promise.all(Array.from({ length: 90 }, () => consumeTransferQuoteQuota("fixture-quota")));
  assert.equal(results.filter(Boolean).length, 60);
  await owner.query("UPDATE sf_api_request_limits SET window_started_at=now()-interval '2 minutes'");
  assert.equal(await consumeTransferQuoteQuota("fixture-quota"), true);
});
test("signed KYC expiry lowers the limit; duplicates, conflicts and stale approval cannot restore it", async () => {
  const session = `fixture-didit-${randomUUID()}`;
  await owner.query(`INSERT INTO sf_identity_verifications(user_id,provider_session_id,vendor_data,verification_url,status)
    VALUES('fixture-a',$1,'fixture-a','https://verify.didit.me/session/fixture','Approved')`, [session]);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-a")).monthlyLimit, 10_000_000);
  const body = { event_id: randomUUID(), session_id: session, webhook_type: "status.updated",
    status: "Kyc Expired", environment: "sandbox", created_at: Math.floor(Date.now() / 1000) - 20,
    timestamp: Math.floor(Date.now() / 1000) - 5 };
  assert.equal((await webhook(body, "invalid")).status, 401);
  assert.equal((await webhook(body)).status, 200);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-a")).monthlyLimit, 150_000);
  assert.equal(JSON.parse((await webhook(body)).text).duplicate, true);
  assert.equal(JSON.parse((await webhook({ ...body, timestamp: body.timestamp + 1 })).text).duplicate, true);
  assert.equal((await webhook({ ...body, status: "Approved" })).status, 409);
  assert.equal((await webhook({ ...body, event_id: randomUUID(), status: "Approved",
    created_at: body.created_at - 1 })).status, 200);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-a")).monthlyLimit, 150_000);
  const receipt = (await owner.query("SELECT encrypted_payload,status_applied FROM sf_identity_webhook_events WHERE event_id=$1",
    [body.event_id])).rows[0];
  assert.equal(receipt.status_applied, true);
  assert.equal(receipt.encrypted_payload.includes(session), false);
  assert.deepEqual(JSON.parse(runtime.decryptSensitiveData(receipt.encrypted_payload, "identity-webhook-payload")), body);
  // A newer webhook cannot clear an ambiguity; only a server read can.
  const reopen = { ...body, event_id: randomUUID(), status: "Approved", created_at: body.created_at + 5 };
  assert.equal((await webhook(reopen)).status, 200);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-a")).monthlyLimit, 150_000);
  const { id } = (await owner.query("SELECT id FROM sf_identity_verifications WHERE provider_session_id=$1", [session])).rows[0];
  assert.equal(await runtime.reconcileIdentityVerification(id, async () => ({
    session_id: session, vendor_data: "fixture-a", environment: "sandbox",
    workflow_id: "fixture-workflow", status: "Approved",
  })), "resolved");
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-a")).monthlyLimit, 10_000_000);
  const aml = { ...body, event_id: randomUUID(), status: "In Review", created_at: body.created_at + 10 };
  assert.equal((await webhook(aml)).status, 200);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-a")).monthlyLimit, 150_000);
  assert.equal((await webhook({ ...reopen, event_id: randomUUID() })).status, 200);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-a")).monthlyLimit, 150_000);
});
test("API errors do not expose database internals or secret configuration names", async () => {
  const res = await request("/api/me/transfer-quote", { method: "POST", user: "fixture-a", body: { amountMinor: -1 } });
  assert.equal(res.status, 400);
  assert.doesNotMatch(res.text, /DATABASE_URL|DIDIT_WEBHOOK_SECRET|CUSTOMER_PII_ENCRYPTION_KEY|postgresql|stack|sf_fixture/i);
});
test("ambiguous signed events hold privileges; only bound server decisions resolve idempotently", async () => {
  const session = randomUUID();
  const seconds = Math.floor(Date.now() / 1000) - 30;
  const { id } = (await owner.query(`INSERT INTO sf_identity_verifications
    (user_id,provider_session_id,vendor_data,verification_url,status,last_provider_event_at)
    VALUES('fixture-b',$1,'fixture-b','https://verify.didit.me/session/fixture','Approved',to_timestamp($2))
    RETURNING id`, [session, seconds])).rows[0];
  const event = { event_id: randomUUID(), session_id: session, webhook_type: "status.updated",
    status: "Declined", environment: "sandbox", created_at: seconds,
    timestamp: Math.floor(Date.now() / 1000) };
  const state = async () => (await owner.query("SELECT * FROM sf_identity_verifications WHERE id=$1", [id])).rows[0];
  const decision = { session_id: session, vendor_data: "fixture-b", environment: "sandbox",
    workflow_id: "fixture-workflow", status: "Approved", created_at: "2020-01-01T00:00:00Z" };
  assert.equal((await webhook(event, "invalid")).status, 401);
  assert.equal((await state()).reconciliation_required, false);
  assert.equal((await webhook(event)).status, 200);
  assert.equal((await state()).status, "In Review");
  assert.equal((await state()).reconciliation_required, true);
  assert.equal((await runtime.getAccountLimitSnapshot("fixture-b")).monthlyLimit, 150_000);
  const version = (await state()).reconciliation_version;
  await Promise.all(Array.from({ length: 8 }, () => webhook({ ...event, timestamp: event.timestamp + 1 })));
  assert.equal((await state()).reconciliation_version, version);
  const receipt = (await owner.query("SELECT * FROM sf_identity_webhook_events WHERE event_id=$1", [event.event_id])).rows[0];
  assert.equal(receipt.status_applied, false);
  assert.deepEqual(JSON.parse(runtime.decryptSensitiveData(receipt.encrypted_payload, "identity-webhook-payload")), event);
  for (const patch of [{ session_id: randomUUID() }, { vendor_data: "other" },
    { environment: "live" }, { workflow_id: "other" }, { status: "APPROVED" },
    { expires_at: "2000-01-01T00:00:00Z" }, { expires_at: "invalid" }, { session_kind: "business" }]) {
    await assert.rejects(runtime.reconcileIdentityVerification(id, async () => ({ ...decision, ...patch })));
    assert.equal((await state()).reconciliation_required, true);
  }
  await assert.rejects(runtime.reconcileIdentityVerification(id, async () => { throw new Error("timeout"); }));
  await assert.rejects(runtime.reconcileIdentityVerification(id), /disabled outside production/);
  let arrived;
  const waiting = new Promise(resolve => { arrived = resolve; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const inflight = runtime.reconcileIdentityVerification(id, async () => { arrived(); await gate; return decision; });
  await waiting;
  assert.equal((await webhook({ ...event, event_id: randomUUID(), status: "Approved", created_at: seconds + 5 })).status, 200);
  release();
  assert.equal(await inflight, "superseded");
  assert.equal((await state()).status, "In Review");
  const results = await Promise.all(Array.from({ length: 6 }, () =>
    runtime.reconcileIdentityVerification(id, async () => decision)));
  assert.equal(results.filter(x => x === "resolved").length, 1);
  assert.equal((await state()).status, "Approved");
  assert.equal((await state()).reconciliation_required, false);
  // Replaying the additive migration must not resurrect a resolved old receipt.
  const { readFileSync } = await import("node:fs");
  await owner.query(readFileSync("lib/db/migrations/2026-10-22-identity-reconciliation.sql", "utf8"));
  assert.equal((await state()).reconciliation_required, false);
  assert.equal(await runtime.reconcileIdentityVerification(id, async () => { throw new Error("must not read"); }), "not_pending");
  const proof = (await owner.query(`SELECT encrypted_payload FROM sf_identity_webhook_events
    WHERE provider_session_id=$1 AND event_type='reconciliation.resolved'`, [session])).rows;
  assert.equal(proof.length, 1);
  assert.deepEqual(JSON.parse(runtime.decryptSensitiveData(proof[0].encrypted_payload, "identity-webhook-payload")).decision, decision);
  assert.equal((await webhook({ ...event, status: "Approved" })).status, 409);
  const conflictedVersion = (await state()).reconciliation_version;
  assert.equal((await state()).status, "In Review");
  assert.equal((await webhook({ ...event, status: "Approved" })).status, 409);
  assert.equal((await state()).reconciliation_version, conflictedVersion);
  assert.equal((await owner.query(`SELECT count(*)::int AS count FROM sf_identity_webhook_events
    WHERE provider_session_id=$1 AND event_id LIKE 'conflict:%'`, [session])).rows[0].count, 1);
  await owner.query(`CREATE FUNCTION fixture_fail_identity_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.event_type='reconciliation.resolved' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_fail_identity_evidence BEFORE INSERT ON sf_identity_webhook_events
    FOR EACH ROW EXECUTE FUNCTION fixture_fail_identity_evidence()`);
  try {
    await assert.rejects(runtime.reconcileIdentityVerification(id, async () => decision));
    assert.equal((await state()).reconciliation_required, true);
    assert.equal((await state()).status, "In Review");
  } finally {
    await owner.query("DROP TRIGGER fixture_fail_identity_evidence ON sf_identity_webhook_events; DROP FUNCTION fixture_fail_identity_evidence()");
  }
});
test("legacy receipts without digests never disguise a signed approval withdrawal as a duplicate", async () => {
  for (const historicalStatus of ["Approved", null]) {
    const session = randomUUID(), eventId = randomUUID();
    const seconds = Math.floor(Date.now() / 1000) - 30;
    const { id } = (await owner.query(`INSERT INTO sf_identity_verifications
      (user_id,provider_session_id,vendor_data,verification_url,status,last_provider_event_at)
      VALUES('fixture-b',$1,'fixture-b','https://verify.didit.me/session/fixture','Approved',to_timestamp($2))
      RETURNING id`, [session, seconds])).rows[0];
    await owner.query(`INSERT INTO sf_identity_webhook_events
      (event_id,provider_session_id,event_type,status,matched_verification,status_applied)
      VALUES($1,$2,'status.updated',$3,true,true)`, [eventId, session, historicalStatus]);
    const state = async () => (await owner.query(
      "SELECT status,reconciliation_required,reconciliation_version FROM sf_identity_verifications WHERE id=$1", [id])).rows[0];
    assert.equal((await runtime.getAccountLimitSnapshot("fixture-b")).monthlyLimit, 10_000_000);
    const withdrawal = { event_id: eventId, session_id: session, webhook_type: "status.updated",
      status: "Declined", environment: "sandbox", created_at: seconds + 5,
      timestamp: Math.floor(Date.now() / 1000) };
    const response = await webhook(withdrawal);
    assert.equal(response.status, 409);
    assert.notEqual(JSON.parse(response.text).duplicate, true);
    assert.equal((await state()).reconciliation_required, true);
    assert.equal((await state()).status, "In Review");
    assert.equal((await runtime.getAccountLimitSnapshot("fixture-b")).monthlyLimit, 150_000);
    const version = (await state()).reconciliation_version;
    assert.equal((await webhook({ ...withdrawal, timestamp: withdrawal.timestamp + 1 })).status, 409);
    assert.equal((await state()).reconciliation_version, version);
    const original = (await owner.query(
      "SELECT status,payload_digest FROM sf_identity_webhook_events WHERE event_id=$1", [eventId])).rows[0];
    assert.equal(original.status, historicalStatus);
    assert.equal(original.payload_digest, null);
    const conflict = (await owner.query(`SELECT encrypted_payload,status_applied FROM sf_identity_webhook_events
      WHERE provider_session_id=$1 AND event_id LIKE 'conflict:%'`, [session])).rows;
    assert.equal(conflict.length, 1);
    assert.equal(conflict[0].status_applied, false);
    assert.deepEqual(JSON.parse(runtime.decryptSensitiveData(conflict[0].encrypted_payload, "identity-webhook-payload")), withdrawal);
    // A later signed approval also cannot remove this hold.
    await webhook({ ...withdrawal, event_id: randomUUID(), status: "Approved", created_at: seconds + 10 });
    assert.equal((await runtime.getAccountLimitSnapshot("fixture-b")).monthlyLimit, 150_000);
    assert.equal(await runtime.reconcileIdentityVerification(id, async () => ({
      session_id: session, vendor_data: "fixture-b", workflow_id: "fixture-workflow",
      environment: "sandbox", status: "Declined",
    })), "resolved");
    assert.equal((await state()).reconciliation_required, false);
    assert.equal((await state()).status, "Declined");
    assert.equal((await runtime.getAccountLimitSnapshot("fixture-b")).monthlyLimit, 150_000);
  }
});
test("malformed and oversized HTTP bodies return safe JSON even in development", async () => {
  const marker = randomUUID();
  const malformed = await request("/api/me/transfer-quote", {
    method: "POST", user: "fixture-a", rawBody: `{"password":"${marker}"`,
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(JSON.parse(malformed.text), { error: "Malformed request body" });
  assert.equal(malformed.text.includes(marker), false);
  assert.match(malformed.headers["content-type"], /application\/json/);
  assert.match(malformed.headers["cache-control"], /no-store/);
  const oversized = await request("/api/me/transfer-quote", {
    method: "POST", user: "fixture-a", body: { fixture: "x".repeat(103_000) },
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(JSON.parse(oversized.text), { error: "Request body too large" });
  const missing = await request("/api/fixture-not-a-real-route");
  assert.equal(missing.status, 404);
  assert.deepEqual(JSON.parse(missing.text), { error: "API route not found" });
  const invalidPath = await request("/api/me/transactions/%E0%A4%A", { user: "fixture-a" });
  assert.equal(invalidPath.status, 400);
  assert.deepEqual(JSON.parse(invalidPath.text), { error: "Malformed request path" });
});
test("a captured signed webhook remains expired when only its unsigned header is refreshed", async () => {
  const now = Math.floor(Date.now() / 1000);
  const stale = { event_id: randomUUID(), session_id: "fixture-old-session", webhook_type: "status.updated",
    status: "Approved", environment: "sandbox", created_at: now - 601, timestamp: now - 601 };
  assert.equal((await webhook(stale, undefined, String(now))).status, 401);
  assert.equal((await webhook({ ...stale, timestamp: now }, "é".repeat(64), String(now))).status, 401);
  assert.equal((await owner.query("SELECT count(*) FROM sf_identity_webhook_events WHERE event_id=$1",
    [stale.event_id])).rows[0].count, "0");
  assert.equal((await webhook({ ...stale, timestamp: undefined }, undefined, String(now))).status, 401);
});
test("deposit and international page payloads receive the real server totals for both fee choices", async () => {
  for (const senderPaysFees of [true, false]) {
    const deposit = await request("/api/me/transfer-quote", { method: "POST", user: "fixture-a", body: {
      kind: "deposit", sourceOperatorId: "fixture-source", senderPhone: "+2250000000000",
      amountMinor: 10_000, senderPaysFees,
    } });
    assert.equal(deposit.status, 200);
    const d = JSON.parse(deposit.text);
    assert.equal(d.feeMinor, 125);
    assert.equal(d.feePercent, 1.25);
    assert.equal(d.recipientAmountMinor, senderPaysFees ? 10_000 : 9_875);
    assert.equal(d.totalDebitMinor, senderPaysFees ? 10_125 : 10_000);
    const international = await request("/api/me/transfer-quote", { method: "POST", user: "fixture-a", body: {
      kind: "international", destinationOperatorId: "fixture-destination", destinationCountryCode: "CI",
      recipientPhone: "+2250000000001", amountMinor: 10_000, senderPaysFees,
    } });
    assert.equal(international.status, 200);
    const i = JSON.parse(international.text);
    assert.equal(i.feeMinor, 180);
    assert.equal(i.feePercent, 1.8);
    assert.equal(i.recipientAmountMinor, senderPaysFees ? 10_000 : 9_820);
    assert.equal(i.totalDebitMinor, senderPaysFees ? 10_180 : 10_000);
  }
});
test("registration rejects unknown, mismatched, disabled countries and invalid national lengths", async () => {
  await owner.query(`INSERT INTO sf_countries(country_code,country_name,phone_prefix,min_phone_digits,max_phone_digits,enabled,created_by,updated_by)
    VALUES('xy','Isolated disabled country','+989',8,8,false,'fixture','fixture')`);
  const before = (await owner.query("SELECT count(*) FROM sf_users")).rows[0].count;
  const body = { fullName: "Country Fixture", birthDate: "1990-01-01",
    phone: "+2250000000777", password: "isolated-password-only", acceptedPrivacy: true };
  for (const [index, change] of [
    { countryCode: "xx" }, { countryCode: "sn" },
    { countryCode: "ci", phone: "+225000000777" },
    { countryCode: "xy", phone: "+98900000000" },
  ].entries()) {
    const response = await request("/api/auth/register", {
      method: "POST",
      headers: { Origin: "https://sendflow-test.invalid", "X-Forwarded-For": `198.51.100.${160 + index}` },
      body: { ...body, phone: `+225000000077${index}`, ...change },
    });
    assert.equal(response.status, 400);
  }
  assert.equal((await owner.query("SELECT count(*) FROM sf_users")).rows[0].count, before);
});

test("shared-Neon access is confined to one provisioned viewer, with real password/PIN and no provider or financial operation", async () => {
  const originalTarget = process.env.SENDFLOW_DATABASE_TARGET;
  const fixturePhone = "+2250000000002", otherPhone = "+2250000000009";
  const fixturePassword = randomBytes(20).toString("base64url");
  const normalPassword = randomBytes(20).toString("base64url");
  const pin = String(randomInt(1000, 10000));
  const origin = { Origin: "https://sendflow-test.invalid" };
  process.env.SENDFLOW_DATABASE_TARGET = "shared-neon";
  try {
    await owner.query("UPDATE sf_users SET phone_lookup_hash=$1 WHERE id='fixture-a'",
      [runtime.createSensitiveDataLookupIndex(otherPhone, "user-phone")]);
    await owner.query("UPDATE sf_customer_credentials SET password_hash=$1 WHERE user_id='fixture-a'",
      [await runtime.hashCustomerSecret(normalPassword)]);
    await assert.rejects(runtime.provisionPreviewAccount(otherPhone, fixturePassword), /already in use/);
    assert.equal((await owner.query("SELECT count(*) FROM sf_preview_access")).rows[0].count, "0");
    await runtime.provisionPreviewAccount(fixturePhone, fixturePassword);
    const { user_id: viewerId } = (await owner.query("SELECT user_id FROM sf_preview_access")).rows[0];
    await assert.rejects(runtime.provisionPreviewAccount(fixturePhone, fixturePassword), /already provisioned/);
    assert.equal((await owner.query("SELECT balance_minor FROM sf_wallets WHERE user_id=$1", [viewerId])).rows[0].balance_minor, "0");
    const credential = (await owner.query("SELECT password_hash,privacy_policy_version FROM sf_customer_credentials WHERE user_id=$1", [viewerId])).rows[0];
    assert.ok(credential.password_hash.startsWith("scrypt$preview-v1$"));
    assert.equal(credential.privacy_policy_version, "internal-preview-authorization-v1");
    const storedUser = (await owner.query("SELECT phone,phone_verified_at FROM sf_users WHERE id=$1", [viewerId])).rows[0];
    assert.notEqual(storedUser.phone, fixturePhone);
    assert.equal(storedUser.phone_verified_at, null);
    // An older production API cannot promote this account via recovery or
    // mint a legacy session, even if it does not know the preview grant table.
    await assert.rejects(owner.query("UPDATE sf_customer_credentials SET password_hash=$1 WHERE user_id=$2",
      [await runtime.hashCustomerSecret(normalPassword), viewerId]), { code: "42501" });
    await assert.rejects(owner.query(`INSERT INTO sf_customer_sessions(user_id,token_hash,expires_at)
      VALUES($1,$2,now()+interval '1 hour')`,
    [viewerId, runtime.hashCustomerSessionToken(randomBytes(32).toString("base64url"))
      .replace(/^pv1_/, "0000")]), { code: "42501" });
    // Legacy application roles need no new grant-table privilege just to
    // continue ordinary customer authentication.
    await owner.query("REVOKE SELECT ON sf_preview_access FROM sf_fixture_app");
    try {
      assert.equal((await pool.query("UPDATE sf_customer_credentials SET password_hash=password_hash WHERE user_id='fixture-a'")).rowCount, 1);
      assert.equal((await pool.query(`INSERT INTO sf_customer_sessions(user_id,token_hash,expires_at)
        VALUES('fixture-a',$1,now()+interval '1 hour')`, [randomBytes(32).toString("hex")])).rowCount, 1);
    } finally { await owner.query("GRANT SELECT ON sf_preview_access TO sf_fixture_app"); }
    const signin = (phone, password) => request("/api/auth/sign-in",
      { method: "POST", headers: origin, body: { phone, password } });
    assert.equal((await signin(otherPhone, normalPassword)).status, 401);
    assert.equal((await signin(fixturePhone, "wrong-fixture-value")).status, 401);
    assert.equal((await request("/api/me", { user: "fixture-a" })).status, 401);
    assert.equal((await request("/api/me/portal-eligibility")).status, 401);
    // Even a correctly scoped cookie belonging to another real customer is denied.
    await owner.query("UPDATE sf_customer_sessions SET token_hash=$1 WHERE user_id='fixture-b'",
      [runtime.hashCustomerSessionToken(tokens["fixture-b"])]);
    assert.equal((await request("/api/me", { user: "fixture-b" })).status, 401);
    const signedIn = await signin(fixturePhone, fixturePassword);
    assert.equal(signedIn.status, 200);
    const setCookie = signedIn.headers["set-cookie"][0];
    for (const flag of ["HttpOnly", "Secure", "SameSite=None"]) assert.ok(setCookie.includes(flag));
    const cookie = setCookie.split(";")[0];
    const headers = { ...origin, Cookie: cookie };
    assert.equal(JSON.parse((await request("/api/auth/session", { headers })).text).pinConfigured, false);
    assert.equal((await request("/api/me", { headers })).status, 403);
    assert.equal((await request("/api/me/pin", { method: "PUT", headers, body: { newPin: pin } })).status, 200);
    assert.equal(JSON.parse((await request("/api/auth/session", { headers })).text).pinUnlocked, true);
    const fresh = await signin(fixturePhone, fixturePassword);
    assert.equal(fresh.status, 200);
    const freshHeaders = { ...origin, Cookie: fresh.headers["set-cookie"][0].split(";")[0] };
    assert.equal((await request("/api/me", { headers: freshHeaders })).status, 403);
    assert.equal((await request("/api/auth/unlock", { method: "POST", headers: freshHeaders, body: { pin } })).status, 200);
    assert.equal((await request("/api/me", { headers: freshHeaders })).status, 200);
    const viewerPortalEligibility = await request("/api/me/portal-eligibility", { headers: freshHeaders });
    assert.equal(viewerPortalEligibility.status, 404);
    assert.equal(viewerPortalEligibility.text, "");
    assert.equal((await request("/api/auth/sign-out", { method: "POST", headers: freshHeaders })).status, 200);
    assert.equal((await request("/api/auth/session", { headers: freshHeaders })).status, 401);
    const profile = await request("/api/me", { headers });
    assert.equal(profile.status, 200);
    assert.ok(!profile.text.includes("fixture-a"));
    assert.equal((await request(`/api/me/transactions/${transactions["fixture-a"]}`, { headers })).status, 404);
    assert.equal((await request("/api/me/transactions", { headers })).status, 200);
    assert.equal((await request("/api/me/transfer-quote", { method: "POST", headers, body: {
      kind: "inter-network", amountMinor: 10_000, senderPaysFees: true,
      sourceOperatorId: "fixture-source", destinationOperatorId: "fixture-destination",
      senderPhone: fixturePhone, recipientPhone: "+2250000000001",
    } })).status, 200);
    for (const path of ["/api/auth/send-otp", "/api/auth/verify-otp", "/api/auth/register",
      "/api/auth/reset-password", "/api/auth/reset-pin", "/api/me/identity-verification",
      "/api/me/transfer", "/api/payments"]) {
      assert.equal((await request(path, { method: "POST", headers, body: {} })).status, 503);
    }
    assert.equal((await request("/api/DMgrgmt-1np5g23g12bGFtMwh/overview", { headers })).status, 503);
    assert.equal((await request("/api/me/future-route", { headers })).status, 503);
    // Neither the password nor the preview session works in the production realm.
    process.env.SENDFLOW_DATABASE_TARGET = "development";
    assert.equal((await signin(fixturePhone, fixturePassword)).status, 401);
    assert.equal((await request("/api/auth/session", { headers })).status, 401);
    process.env.SENDFLOW_DATABASE_TARGET = "shared-neon";
    // A mistaken grant to a normal credential cannot turn the dummy hash into access.
    await owner.query("UPDATE sf_preview_access SET user_id='fixture-a'");
    assert.equal((await signin(otherPhone, normalPassword)).status, 401);
    // Separate authorization cases from the real brute-force lockout.
    // This resets only the disposable fixture database, never the application policy.
    await owner.query("DELETE FROM sf_customer_auth_attempts");
    assert.equal((await signin(otherPhone, "sendflow-invalid-account-password")).status, 401);
    await owner.query("UPDATE sf_preview_access SET user_id=$1", [viewerId]);
    await owner.query("UPDATE sf_preview_access SET revoked_at=now()");
    assert.equal((await request("/api/auth/session", { headers })).status, 401);
    await owner.query("DELETE FROM sf_customer_auth_attempts");
    assert.equal((await signin(fixturePhone, fixturePassword)).status, 401);
    await owner.query(`UPDATE sf_preview_access SET revoked_at=NULL,
      created_at=now()-interval '2 days',expires_at=now()-interval '1 day'`);
    assert.equal((await request("/api/auth/session", { headers })).status, 401);
    await owner.query("DELETE FROM sf_customer_auth_attempts");
    assert.equal((await signin(fixturePhone, fixturePassword)).status, 401);
    assert.equal((await owner.query("SELECT count(*) FROM sf_transactions")).rows[0].count, "3");
    assert.equal((await owner.query("SELECT count(*) FROM sf_wallet_ledger WHERE user_id=$1", [viewerId])).rows[0].count, "0");
    assert.equal((await owner.query("SELECT count(*) FROM sf_admin_audit_logs WHERE action='provision_preview_account'")).rows[0].count, "1");
    assert.equal(externalCalls, 0);
  } finally { process.env.SENDFLOW_DATABASE_TARGET = originalTarget; }
});
