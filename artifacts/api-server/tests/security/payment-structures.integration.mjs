import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { encryptSensitiveData, createSensitiveDataLookupIndex } from "../../src/lib/sensitive-data-crypto.ts";
import { applyPaymentStructures, planPaymentStructures, paymentStructureCatalog } from "../../scripts/payment-structures-migration.mjs";

// Fail before opening any connection if invoked outside the private fixture.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
const socket = url.searchParams.get("host");
assert.match(socket ?? "", /^\/tmp\/sendflow-isolated-finance-[^/]+\/socket$/);
assert.equal(process.env.SENDFLOW_DATABASE_TARGET, "development");
globalThis.fetch = async () => { throw new Error("External requests forbidden in financial fixtures"); };
const app = new pg.Pool({ connectionString: url.toString(), max: 12 });
const owner = new pg.Pool({ host: socket, port: 15432, database: "postgres", user: "sf_fixture_owner", max: 2 });
const hash = (value = randomUUID()) => createHash("sha256").update(value).digest("hex");
const provider = "fixture-payment-structures";
const denied = (promise, codes = ["23514", "23505", "23503"]) =>
  assert.rejects(promise, (e) => codes.includes(e.code), "Expected a database integrity refusal");

before(async () => {
  await owner.query(`INSERT INTO sf_payment_aggregators(code,name,enabled,created_by,updated_by)
    VALUES($1,'Isolated fixture',false,'fixture','fixture')`, [provider]);
});
after(async () => { await app.end(); await owner.end(); });

async function customer(balance = 1000, currency = "XOF") {
  const userId = randomUUID();
  await app.query("INSERT INTO sf_users(id,status,display_name) VALUES($1,'active','Isolated financial fixture')", [userId]);
  const wallet = (await app.query(`INSERT INTO sf_wallets(user_id,currency,balance_minor)
    VALUES($1,$2,$3) RETURNING *`, [userId, currency, balance])).rows[0];
  return { userId, wallet };
}
async function intent({ kind = "deposit", amount = 100, fee = 5, payer = "sender", account, currency = "XOF" } = {}) {
  account ??= await customer();
  const transaction = (await app.query(`INSERT INTO sf_transactions
    (user_id,kind,status,currency,amount_minor,fee_minor,reference,idempotency_key,sender_phone,recipient_phone)
    VALUES($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
  [account.userId, kind, currency, amount, fee, randomUUID(), randomUUID(),
    encryptSensitiveData("fixture-sender", "transaction-sender-phone"),
    encryptSensitiveData("fixture-recipient", "transaction-recipient-phone")])).rows[0];
  const payment = (await app.query(`INSERT INTO sf_payment_intents
    (transaction_id,provider_code,request_hash,kind,currency,amount_minor,fee_minor,fee_payer,sender_total_minor,recipient_total_minor)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
  [transaction.id, provider, hash(), kind, currency, amount, fee, payer,
    payer === "sender" ? amount + fee : amount, payer === "recipient" ? amount - fee : amount])).rows[0];
  return { payment, transaction, account };
}
async function reserve(p, executor = app) {
  return (await executor.query(`INSERT INTO sf_wallet_payment_reservations
    (intent_id,wallet_id,amount_minor,currency) VALUES($1,$2,$3,$4) RETURNING *`,
  [p.payment.id, p.account.wallet.id, p.payment.sender_total_minor, p.payment.currency])).rows[0];
}
async function attempt(p, direction = p.payment.kind === "international" ? "payout" : "payin") {
  return (await app.query(`INSERT INTO sf_payment_attempts
    (intent_id,direction,country_code,channel_id,operation_reference,amount_minor,currency)
    VALUES($1,$2,'ci','fixture-channel',$3,$4,$5) RETURNING *`,
  [p.payment.id, direction, randomBytes(12).toString("hex").toUpperCase(),
    direction === "payin" ? p.payment.sender_total_minor : p.payment.recipient_total_minor, p.payment.currency])).rows[0];
}
async function dispatch(leg, status = "pending") {
  await app.query("UPDATE sf_payment_attempts SET status='dispatching' WHERE id=$1", [leg.id]);
  const reference = randomUUID();
  return (await app.query(`UPDATE sf_payment_attempts SET status=$2,provider_reference=$3,
    provider_reference_hash=$4 WHERE id=$1 RETURNING *`, [leg.id, status,
    encryptSensitiveData(reference, "provider-reference"), createSensitiveDataLookupIndex(reference, "provider-reference")])).rows[0];
}
async function evidence(leg, status = "succeeded", overrides = {}) {
  const data = { attemptId: leg.id, fingerprint: hash(), source: "provider_status", status,
    referenceHash: leg.provider_reference_hash, amount: leg.amount_minor, currency: leg.currency,
    payload: encryptSensitiveData(JSON.stringify({ status, amount: leg.amount_minor, currency: leg.currency }), "payment-confirmation-payload"),
    ...overrides };
  return (await app.query(`INSERT INTO sf_payment_confirmations
    (attempt_id,event_fingerprint,source,provider_status,provider_reference_hash,amount_minor,currency,encrypted_payload,verified_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING *`, [
    data.attemptId, data.fingerprint, data.source, data.status, data.referenceHash, data.amount, data.currency, data.payload,
  ])).rows[0];
}
async function finish(leg, status = "succeeded") {
  const proof = await evidence(leg, status);
  await app.query("UPDATE sf_payment_attempts SET status=$2,final_confirmation_id=$3 WHERE id=$1", [leg.id, status, proof.id]);
  return proof;
}
async function international(options = {}) {
  const p = await intent({ ...options, kind: "international" });
  p.reservation = await reserve(p);
  await app.query("UPDATE sf_payment_intents SET state='paying' WHERE id=$1", [p.payment.id]);
  p.leg = await dispatch(await attempt(p));
  return p;
}
async function postLedger(client, p, direction, amount) {
  const wallet = (await client.query("SELECT * FROM sf_wallets WHERE id=$1 FOR UPDATE", [p.account.wallet.id])).rows[0];
  const after = Number(wallet.balance_minor) + (direction === "credit" ? amount : -amount);
  const entry = (await client.query(`INSERT INTO sf_wallet_ledger
    (wallet_id,user_id,direction,amount_minor,balance_before_minor,balance_after_minor,currency,reason,admin_user_id,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,'Isolated payment settlement','system:payments',$8) RETURNING *`,
  [wallet.id, p.account.userId, direction, amount, wallet.balance_minor, after, p.payment.currency,
    `payment:${p.payment.id}:${direction}`])).rows[0];
  return { entry, after };
}

test("migration is versioned, repeatable and does not grant PUBLIC access", async () => {
  const client = await owner.connect();
  try {
    const plan = await planPaymentStructures(client);
    assert.equal(plan.alreadyApplied, true);
    assert.deepEqual(await applyPaymentStructures(client, plan.fingerprint), { applied: false, alreadyApplied: true });
    const catalog = await paymentStructureCatalog(client);
    assert.equal(catalog.relations.length, 5);
    assert.equal(catalog.relations.some((r) => r.public_access), false);
    assert.equal(catalog.routines.some((r) => r.public_access), false);
    assert.equal(catalog.triggers.some((t) => t.tgenabled !== "O"), false);
    await denied(app.query("SELECT * FROM sf_payment_schema_versions"), ["42501"]);
  } finally { client.release(); }
});

test("stale migration plans fail without touching the database", async () => {
  const client = await owner.connect();
  try {
    await assert.rejects(applyPaymentStructures(client, "0".repeat(64)), { code: "STALE_PAYMENT_MIGRATION_PLAN" });
    assert.equal((await planPaymentStructures(client)).alreadyApplied, true);
  } finally { client.release(); }
});

test("disabled guards are detected as schema drift, not silently repaired", async () => {
  const client = await owner.connect();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE sf_wallets DISABLE TRIGGER sf_payment_wallet_reserved_floor");
    assert.deepEqual((await planPaymentStructures(client)).conflicts, ["EXISTING_PAYMENT_SCHEMA_DRIFT"]);
  } finally { await client.query("ROLLBACK"); client.release(); }
});

test("one transaction has one immutable intent and one leg per direction", async () => {
  const p = await intent();
  await denied(app.query(`INSERT INTO sf_payment_intents
    (transaction_id,provider_code,request_hash,kind,currency,amount_minor,fee_minor,fee_payer,sender_total_minor,recipient_total_minor)
    SELECT transaction_id,provider_code,request_hash,kind,currency,amount_minor,fee_minor,fee_payer,sender_total_minor,recipient_total_minor
    FROM sf_payment_intents WHERE id=$1`, [p.payment.id]), ["23505"]);
  await attempt(p);
  await denied(attempt(p), ["23505"]);
  await denied(app.query("UPDATE sf_payment_intents SET fee_minor=0 WHERE id=$1", [p.payment.id]));
  await denied(app.query("UPDATE sf_transactions SET amount_minor=1 WHERE id=$1", [p.transaction.id]));
});

test("sender and recipient fee arithmetic must match the transaction snapshot", async () => {
  const p = await intent({ payer: "recipient" });
  assert.equal(Number(p.payment.sender_total_minor), 100);
  assert.equal(Number(p.payment.recipient_total_minor), 95);
  await denied(app.query("UPDATE sf_payment_intents SET sender_total_minor=1 WHERE id=$1", [p.payment.id]));
  await denied(app.query("UPDATE sf_payment_intents SET currency='XAF' WHERE id=$1", [p.payment.id]));
  await denied(app.query("UPDATE sf_payment_attempts SET amount_minor=1 WHERE id=$1", [(await attempt(p)).id]));
});

test("success cannot be forged by a status update or a browser redirect", async () => {
  const p = await intent();
  const leg = await dispatch(await attempt(p));
  await app.query("UPDATE sf_payment_intents SET state='collecting' WHERE id=$1", [p.payment.id]);
  await denied(app.query("UPDATE sf_payment_intents SET state='succeeded' WHERE id=$1", [p.payment.id]));
  await denied(app.query("UPDATE sf_transactions SET status='succeeded' WHERE id=$1", [p.transaction.id]));
  await denied(app.query("UPDATE sf_payment_attempts SET status='succeeded' WHERE id=$1", [leg.id]));
  await denied(evidence(leg, "succeeded", { source: "browser_redirect" }));
});

test("confirmations reject mismatched amounts, currencies, references and plaintext", async () => {
  const p = await intent();
  const leg = await dispatch(await attempt(p));
  for (const override of [{ amount: 1 }, { currency: "XAF" }, { referenceHash: hash() }, { payload: '{"status":"success"}' }]) {
    await denied(evidence(leg, "succeeded", override));
  }
  await denied(evidence(await attempt(await intent())), ["23514"]);
});

test("duplicate events are refused and payment evidence is append-only", async () => {
  const leg = await dispatch(await attempt(await intent()));
  const proof = await evidence(leg);
  await denied(evidence(leg, "succeeded", { fingerprint: proof.event_fingerprint }), ["23505"]);
  await denied(app.query("UPDATE sf_payment_confirmations SET provider_status='failed' WHERE id=$1", [proof.id]));
  await denied(app.query("DELETE FROM sf_payment_confirmations WHERE id=$1", [proof.id]));
  await denied(owner.query("TRUNCATE sf_payment_confirmations CASCADE"));
});

test("provider references cannot be swapped and final states cannot regress", async () => {
  const leg = await dispatch(await attempt(await intent()));
  await denied(app.query("UPDATE sf_payment_attempts SET provider_reference_hash=$2 WHERE id=$1", [leg.id, hash()]));
  await finish(leg);
  await denied(app.query("UPDATE sf_payment_attempts SET status='pending' WHERE id=$1", [leg.id]));
  await denied(app.query("UPDATE sf_payment_attempts SET status='failed',final_confirmation_id=null WHERE id=$1", [leg.id]));
});

test("encrypted references and their hashes must always be present together", async () => {
  const leg = await attempt(await intent());
  await app.query("UPDATE sf_payment_attempts SET status='dispatching' WHERE id=$1", [leg.id]);
  await denied(app.query("UPDATE sf_payment_attempts SET provider_reference_hash=$2 WHERE id=$1", [leg.id, hash()]));
  await denied(app.query("UPDATE sf_payment_attempts SET provider_reference=$2 WHERE id=$1",
    [leg.id, encryptSensitiveData("fixture-reference", "provider-reference")]));
});

test("releasing a prepared payout hold prevents dispatch even before the intent is cancelled", async () => {
  const p = await intent({ kind: "international" });
  const held = await reserve(p);
  const leg = await attempt(p);
  await app.query("UPDATE sf_wallet_payment_reservations SET state='released' WHERE id=$1", [held.id]);
  await denied(app.query("UPDATE sf_payment_attempts SET status='dispatching' WHERE id=$1", [leg.id]));
  assert.equal((await app.query("SELECT dispatched_at FROM sf_payment_attempts WHERE id=$1", [leg.id])).rows[0].dispatched_at, null);
});

test("an uncertain dispatch cannot be sent twice, failed speculatively or released", async () => {
  const p = await international();
  await app.query("UPDATE sf_payment_attempts SET status='uncertain' WHERE id=$1", [p.leg.id]);
  await denied(app.query("UPDATE sf_payment_attempts SET status='dispatching' WHERE id=$1", [p.leg.id]));
  await denied(app.query("UPDATE sf_payment_attempts SET status='failed' WHERE id=$1", [p.leg.id]));
  await denied(app.query("UPDATE sf_wallet_payment_reservations SET state='released' WHERE id=$1", [p.reservation.id]));
  await denied(app.query("UPDATE sf_payment_intents SET state='failed' WHERE id=$1", [p.payment.id]));
});

test("wallet reservations reject another user's wallet and principal-only holds", async () => {
  const p = await intent({ kind: "international" });
  const other = await customer();
  await denied(app.query(`INSERT INTO sf_wallet_payment_reservations(intent_id,wallet_id,amount_minor,currency)
    VALUES($1,$2,$3,'XOF')`, [p.payment.id, other.wallet.id, p.payment.sender_total_minor]));
  await denied(app.query(`INSERT INTO sf_wallet_payment_reservations(intent_id,wallet_id,amount_minor,currency)
    VALUES($1,$2,100,'XOF')`, [p.payment.id, p.account.wallet.id]));
  const foreignCurrency = await intent({ kind: "international", currency: "XAF", account: p.account });
  await denied(reserve(foreignCurrency));
});

test("deposits do not reserve wallets and payouts cannot precede funding", async () => {
  await denied(reserve(await intent()));
  await denied(attempt(await intent({ kind: "international" })));
  await denied(attempt(await intent({ kind: "inter-network" }), "payout"));
});

test("concurrent reservations cannot exceed a wallet balance", async () => {
  const account = await customer(1000);
  const requests = await Promise.all(Array.from({ length: 10 }, () => intent({ kind: "international", amount: 200, fee: 0, account })));
  const results = await Promise.allSettled(requests.map((p) => reserve(p)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
  assert.equal(results.filter((r) => r.status === "rejected" && r.reason.code === "23514").length, 5);
  assert.equal(Number((await app.query(`SELECT sum(amount_minor) AS held FROM sf_wallet_payment_reservations
    WHERE wallet_id=$1 AND state='active'`, [account.wallet.id])).rows[0].held), 1000);
  assert.equal(Number((await app.query("SELECT balance_minor FROM sf_wallets WHERE id=$1", [account.wallet.id])).rows[0].balance_minor), 1000);
});

test("REPEATABLE READ snapshots cannot hide another committed reservation", async () => {
  const account = await customer(1000);
  const p1 = await intent({ kind: "international", amount: 600, fee: 0, account });
  const p2 = await intent({ kind: "international", amount: 600, fee: 0, account });
  const a = await app.connect(), b = await app.connect();
  try {
    await a.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await b.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await a.query("SELECT balance_minor FROM sf_wallets WHERE id=$1", [account.wallet.id]);
    await b.query("SELECT balance_minor FROM sf_wallets WHERE id=$1", [account.wallet.id]);
    await reserve(p1, a);
    const second = reserve(p2, b).then(() => null, (e) => e);
    await a.query("COMMIT");
    assert.equal((await second)?.code, "40001");
  } finally { await a.query("ROLLBACK"); await b.query("ROLLBACK"); a.release(); b.release(); }
});

test("reserved funds cannot be spent by a different wallet debit", async () => {
  const p = await intent({ kind: "international", amount: 800, fee: 0 });
  await reserve(p);
  await denied(app.query("UPDATE sf_wallets SET balance_minor=799 WHERE id=$1", [p.account.wallet.id]));
  await denied(app.query("UPDATE sf_wallets SET currency='XAF' WHERE id=$1", [p.account.wallet.id]));
  await app.query("UPDATE sf_wallets SET balance_minor=850 WHERE id=$1", [p.account.wallet.id]);
});

test("an undispatched cancellation releases its hold but cannot later dispatch", async () => {
  const p = await intent({ kind: "international" });
  const held = await reserve(p);
  const leg = await attempt(p);
  await app.query("UPDATE sf_wallet_payment_reservations SET state='released' WHERE id=$1", [held.id]);
  await app.query("UPDATE sf_payment_intents SET state='failed' WHERE id=$1", [p.payment.id]);
  await denied(app.query("UPDATE sf_payment_attempts SET status='dispatching' WHERE id=$1", [leg.id]));
  await denied(app.query("UPDATE sf_wallet_payment_reservations SET state='active' WHERE id=$1", [held.id]));
});

test("only confirmed payout failure releases dispatched wallet funds", async () => {
  const p = await international();
  const proof = await finish(p.leg, "failed");
  await denied(app.query("UPDATE sf_payment_intents SET state='failed' WHERE id=$1", [p.payment.id]));
  await app.query("UPDATE sf_wallet_payment_reservations SET state='released',confirmation_id=$2 WHERE id=$1", [p.reservation.id, proof.id]);
  await app.query("UPDATE sf_payment_intents SET state='failed' WHERE id=$1", [p.payment.id]);
  await app.query("UPDATE sf_transactions SET status='failed' WHERE id=$1", [p.transaction.id]);
  assert.equal(Number((await app.query("SELECT balance_minor FROM sf_wallets WHERE id=$1", [p.account.wallet.id])).rows[0].balance_minor), 1000);
});

test("international settlement binds a unique debit, consumed hold and confirmed success atomically", async () => {
  const p = await international();
  const proof = await finish(p.leg);
  const client = await app.connect();
  try {
    await client.query("BEGIN");
    const { entry, after } = await postLedger(client, p, "debit", Number(p.payment.sender_total_minor));
    await client.query(`UPDATE sf_wallet_payment_reservations SET state='consumed',confirmation_id=$2,ledger_entry_id=$3 WHERE id=$1`,
      [p.reservation.id, proof.id, entry.id]);
    await client.query("UPDATE sf_wallets SET balance_minor=$2 WHERE id=$1", [p.account.wallet.id, after]);
    await client.query("UPDATE sf_payment_intents SET state='succeeded',ledger_entry_id=$2 WHERE id=$1", [p.payment.id, entry.id]);
    await client.query("UPDATE sf_transactions SET status='succeeded' WHERE id=$1", [p.transaction.id]);
    await client.query("COMMIT");
    assert.equal(after, 895);
    await denied(postLedger(app, p, "debit", Number(p.payment.sender_total_minor)), ["23505"]);
    assert.equal(Number((await app.query("SELECT balance_minor FROM sf_wallets WHERE id=$1", [p.account.wallet.id])).rows[0].balance_minor), 895);
  } finally { await client.query("ROLLBACK"); client.release(); }
});

test("deposit credits the server-calculated recipient amount, not the collected total", async () => {
  const p = await intent({ payer: "recipient" });
  const leg = await dispatch(await attempt(p));
  await finish(leg);
  await app.query("UPDATE sf_payment_intents SET state='collecting' WHERE id=$1", [p.payment.id]);
  const client = await app.connect();
  try {
    await client.query("BEGIN");
    const { entry, after } = await postLedger(client, p, "credit", 95);
    await client.query("UPDATE sf_wallets SET balance_minor=$2 WHERE id=$1", [p.account.wallet.id, after]);
    await client.query("UPDATE sf_payment_intents SET state='succeeded',ledger_entry_id=$2 WHERE id=$1", [p.payment.id, entry.id]);
    await client.query("UPDATE sf_transactions SET status='succeeded' WHERE id=$1", [p.transaction.id]);
    await client.query("COMMIT");
    assert.equal(after, 1095);
  } finally { await client.query("ROLLBACK"); client.release(); }
});

test("inter-network collected funds require reconciliation while payout outcome is unknown", async () => {
  const p = await intent({ kind: "inter-network" });
  await app.query("UPDATE sf_payment_intents SET state='collecting' WHERE id=$1", [p.payment.id]);
  await finish(await dispatch(await attempt(p)));
  await app.query("UPDATE sf_payment_intents SET state='funded' WHERE id=$1", [p.payment.id]);
  const payout = await dispatch(await attempt(p, "payout"), "uncertain");
  await app.query("UPDATE sf_payment_intents SET state='paying' WHERE id=$1", [p.payment.id]);
  await denied(app.query("UPDATE sf_payment_intents SET state='refund_due' WHERE id=$1", [p.payment.id]));
  await denied(app.query("UPDATE sf_payment_intents SET state='failed' WHERE id=$1", [p.payment.id]));
  await finish(payout, "failed");
  await app.query("UPDATE sf_payment_intents SET state='refund_due' WHERE id=$1", [p.payment.id]);
});

test("legacy transactions with no new intent retain their existing behavior", async () => {
  const account = await customer();
  const id = randomUUID();
  await app.query(`INSERT INTO sf_transactions
    (id,user_id,kind,status,currency,amount_minor,fee_minor,reference,idempotency_key,sender_phone,recipient_phone)
    VALUES($1,$2,'deposit','pending','XOF',100,0,$3,$4,$5,$6)`, [id, account.userId, randomUUID(), randomUUID(),
    encryptSensitiveData("fixture-sender", "transaction-sender-phone"),
    encryptSensitiveData("fixture-recipient", "transaction-recipient-phone")]);
  await app.query("UPDATE sf_transactions SET amount_minor=101 WHERE id=$1", [id]);
  assert.equal(Number((await app.query("SELECT amount_minor FROM sf_transactions WHERE id=$1", [id])).rows[0].amount_minor), 101);
});
