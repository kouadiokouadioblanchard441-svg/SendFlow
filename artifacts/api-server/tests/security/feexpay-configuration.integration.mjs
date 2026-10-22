import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";
import { feexpayChannels, feexpayChannelForOperator, feexpayOperations, sendflowOperatorId } from "../../src/providers/feexpay/catalog.ts";
import { planFeexpayConfiguration } from "../../src/providers/feexpay/configuration-plan.ts";
import { applyFeexpayConfiguration, readFeexpayConfiguration } from "../../src/providers/feexpay/configuration-store.ts";

const socket = process.env.SENDFLOW_FIXTURE_SOCKET;
if (!socket?.startsWith("/tmp/sendflow-isolated-finance-") || process.env.SENDFLOW_DATABASE_TARGET !== "development") {
  throw new Error("Disposable local PostgreSQL fixture required; Neon credentials are never used.");
}
const connection = { host: socket, port: 15432, database: "postgres" };
const owner = new pg.Pool({ ...connection, user: "sf_fixture_owner" });
const app = new pg.Pool({ ...connection, user: "sf_fixture_app" });
const missing = ["celtiis-bj", "coris-bj", "wave-bf"];

async function snapshot() {
  const client = await app.connect();
  try { return await readFeexpayConfiguration(client); }
  finally { client.release(); }
}
async function apply(fingerprint) {
  const client = await app.connect();
  try { return await applyFeexpayConfiguration(client, fingerprint); }
  finally { client.release(); }
}
async function auditCount() {
  return Number((await app.query("SELECT count(*) AS n FROM sf_admin_audit_logs WHERE admin_user_id=$1",
    ["system:feexpay-configuration"])).rows[0].n);
}
async function seed() {
  // Only disposable configuration tables, never financial/customer data.
  await owner.query(`DELETE FROM sf_operation_aggregator_routes;
    DELETE FROM sf_payment_aggregators; DELETE FROM sf_operator_pricing_rates;
    DELETE FROM sf_operator_catalog`);
  for (const channel of feexpayChannels.filter((entry) => !missing.includes(sendflowOperatorId(entry)))) {
    await owner.query(`INSERT INTO sf_operator_catalog
      (operator_id,country_code,name,short_name,initials,brand,created_by,updated_by)
      VALUES ($1,$2,$3,$3,'OP','generic','fixture','fixture')`,
    [sendflowOperatorId(channel), channel.countryCode.toLowerCase(), channel.operator]);
  }
  await owner.query(`INSERT INTO sf_operator_catalog
    (operator_id,country_code,name,short_name,initials,brand,created_by,updated_by)
    VALUES ('telecel-bf','bf','Telecel','Telecel','TE','generic','fixture','fixture')`);
  await owner.query(`INSERT INTO sf_operator_pricing_rates
    (operator_id,country_code,category_id,fee_percent,created_by,updated_by)
    VALUES ('mtn-ci','ci','deposit',1.2500,'fixture','fixture')`);
}
before(seed);
after(async () => { await app.end(); await owner.end(); });

test("exact country/operator coverage, explicit Togo aliases, Coris payin only and XAF exclusion", async () => {
  assert.equal(feexpayChannelForOperator("tg", "tmoney-tg")?.id, "togocom-tg");
  assert.equal(feexpayChannelForOperator("tg", "flooz-tg")?.id, "moov-tg");
  assert.equal(feexpayChannelForOperator("ci", "mtn-bj"), undefined);
  assert.equal(feexpayChannelForOperator("bf", "telecel-bf"), undefined);
  assert.deepEqual(feexpayOperations(feexpayChannelForOperator("bj", "coris-bj")), ["deposit"]);
  const plan = planFeexpayConfiguration(await snapshot());
  assert.equal(plan.newRoutes.length, 46);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.newOperators.map((row) => row.operator_id).sort(), [...missing].sort());
  assert.deepEqual(plan.excludedCountries, [{ countryCode: "cg", reason: "XAF_NOT_SUPPORTED_BY_SENDFLOW" }]);
  for (const id of ["mtn-ci", "moov-ci", "orange-ci", "wave-ci"]) {
    assert.equal(plan.newRoutes.filter((row) => row.operator_id === id).length, 3);
  }
  assert.equal(plan.newRoutes.some((row) => row.operator_id === "telecel-bf" || row.country_code === "cg"), false);
});

test("atomic inserts: 46 routes, three disabled operators, disabled provider; prices and existing settings untouched", async () => {
  const initial = await snapshot();
  const prices = (await app.query("SELECT * FROM sf_operator_pricing_rates")).rows;
  const audits = await auditCount();
  assert.deepEqual(await apply(planFeexpayConfiguration(initial).fingerprint),
    { providers: 1, operators: 3, routes: 46, audits: 50 });
  const current = await snapshot();
  assert.deepEqual(current.countries, initial.countries);
  assert.deepEqual(current.operators.filter((row) => !missing.includes(row.operator_id)), initial.operators);
  for (const row of current.operators.filter((row) => missing.includes(row.operator_id))) {
    for (const flag of ["enabled", "deposit_enabled", "inter_network_enabled", "international_enabled"]) assert.equal(row[flag], false);
  }
  assert.equal(current.providers.find((row) => row.code === "feexpay").enabled, false);
  assert.deepEqual((await app.query("SELECT * FROM sf_operator_pricing_rates")).rows, prices);
  assert.equal(await auditCount() - audits, 50);
  assert.equal(current.routes.every((row) => row.scope_type === "operator"), true);
});

test("re-running a freshly reviewed plan creates no duplicates or additional audit rows", async () => {
  const audits = await auditCount();
  const plan = planFeexpayConfiguration(await snapshot());
  assert.deepEqual(await apply(plan.fingerprint), { providers: 0, operators: 0, routes: 0, audits: 0 });
  assert.equal(await auditCount(), audits);
});

test("a changed configuration invalidates the reviewed fingerprint without partial writes", async () => {
  const plan = planFeexpayConfiguration(await snapshot());
  await owner.query("UPDATE sf_operator_catalog SET version=version+1 WHERE operator_id='mtn-ci'");
  const changed = await snapshot();
  await assert.rejects(apply(plan.fingerprint), { code: "STALE_PLAN" });
  assert.deepEqual(await snapshot(), changed);
});

test("an existing manual operator choice, including explicit null, cannot be silently replaced", async () => {
  await seed();
  await owner.query(`INSERT INTO sf_operation_aggregator_routes
    (scope_type,scope_key,country_code,operation,operator_id,aggregator_code,created_by,updated_by)
    VALUES ('operator','ci:mtn-ci','ci','deposit','mtn-ci',null,'fixture','fixture')`);
  const initial = await snapshot();
  const plan = planFeexpayConfiguration(initial);
  assert.ok(plan.conflicts.includes("EXISTING_OPERATOR_CHOICE:mtn-ci:deposit"));
  await assert.rejects(apply(plan.fingerprint), { code: "MANUAL_CONFIGURATION_CONFLICT" });
  assert.deepEqual(await snapshot(), initial);
});

test("existing country defaults remain authoritative and conflicting imports are refused", async () => {
  await seed();
  await owner.query(`INSERT INTO sf_operation_aggregator_routes
    (scope_type,scope_key,country_code,operation,aggregator_code,created_by,updated_by)
    VALUES ('country','ci','ci','deposit','another-provider','fixture','fixture')`);
  const initial = await snapshot();
  const plan = planFeexpayConfiguration(initial);
  assert.ok(plan.conflicts.includes("EXISTING_COUNTRY_CHOICE:ci:deposit"));
  await assert.rejects(apply(plan.fingerprint), { code: "MANUAL_CONFIGURATION_CONFLICT" });
  assert.deepEqual(await snapshot(), initial);
});

test("audit storage failure rolls back the entire configuration", async () => {
  await seed();
  await owner.query(`CREATE FUNCTION reject_feexpay_fixture_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture audit rejection'; END $$;
    CREATE TRIGGER reject_feexpay_fixture_audit BEFORE INSERT ON sf_admin_audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_feexpay_fixture_audit()`);
  try {
    const initial = await snapshot();
    await assert.rejects(apply(planFeexpayConfiguration(initial).fingerprint), { code: "P0001" });
    assert.deepEqual(await snapshot(), initial);
  } finally {
    await owner.query(`DROP TRIGGER reject_feexpay_fixture_audit ON sf_admin_audit_logs;
      DROP FUNCTION reject_feexpay_fixture_audit()`);
  }
});

test("concurrent imports cannot duplicate routes, operators, provider or audit entries", async () => {
  await seed();
  const plan = planFeexpayConfiguration(await snapshot());
  const audits = await auditCount();
  const results = await Promise.allSettled([apply(plan.fingerprint), apply(plan.fingerprint)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(["40001", "STALE_PLAN"].includes(rejected.reason.code));
  const current = await snapshot();
  assert.equal(current.routes.length, 46);
  assert.equal(current.providers.filter((row) => row.code === "feexpay").length, 1);
  assert.equal(current.operators.filter((row) => missing.includes(row.operator_id)).length, 3);
  assert.equal(await auditCount() - audits, 50);
});
