import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import http from "node:http";
import pg from "pg";

const runtimePath = process.env.SENDFLOW_ISOLATED_RUNTIME;
const socket = process.env.SENDFLOW_FIXTURE_SOCKET;
if (!runtimePath?.includes("/sendflow-isolated-finance-") || !socket?.includes("/sendflow-isolated-finance-")) {
  throw new Error("Run via run-isolated-finance.mjs; a disposable database is mandatory");
}
globalThis.fetch = async () => { throw new Error("External network is forbidden in this suite"); };
const runtime = createRequire(import.meta.url)(runtimePath);
const owner = new pg.Pool({ host: socket, port: 15432, database: "postgres", user: "sf_fixture_owner" });
const { pool, executeAdminWalletAdjustment, consumeTransferQuoteQuota } = runtime;
const tokens = {}, transactions = {};
let server;

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
  for (const id of ["fixture-source", "fixture-destination"]) {
    await owner.query(`INSERT INTO sf_operator_catalog
      (operator_id,country_code,name,short_name,initials,brand,enabled,created_by,updated_by)
      VALUES($1,'ci','Fixture operator','Fixture','FX','fixture',true,'fixture','fixture')`, [id]);
  }
  await owner.query(`INSERT INTO sf_operator_pricing_rates
    (operator_id,country_code,category_id,fee_percent,version,created_by,updated_by)
    VALUES('fixture-source','ci','inter-network',2,1,'fixture','fixture')`);
  server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  await owner.end();
});

function request(path, { method = "GET", user, body, headers = {} } = {}) {
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1", port: server.address().port, path, method,
      headers: { ...(user ? { Cookie: `__Host-sendflow_session=${tokens[user]}` } : {}),
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
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]));
  return value;
}
function webhook(body, signature) {
  return request("/api/webhooks/didit", { method: "POST", body, headers: {
    "X-Timestamp": String(Math.floor(Date.now() / 1000)),
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
  assert.equal((await request("/api/DMgrgmt-1np5g23g12bGFtMwh/overview", { user: "fixture-a" })).status, 503);
  assert.equal((await request(`/api/DMgrgmt-1np5g23g12bGFtMwh/users/fixture-a/wallet-adjustments`, {
    user: "fixture-a", method: "POST", body: { isAdmin: true, ...adjustment() },
    headers: { Origin: "https://sendflow-test.invalid" },
  })).status, 503);
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
    await assert.rejects(owner.query(`TRUNCATE ${table}`), (e) => e.code === "23514");
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
  // A genuinely newer signed provider decision may reopen a review; its older
  // approval cannot undo a subsequent AML withdrawal.
  const reopen = { ...body, event_id: randomUUID(), status: "Approved", created_at: body.created_at + 5 };
  assert.equal((await webhook(reopen)).status, 200);
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
