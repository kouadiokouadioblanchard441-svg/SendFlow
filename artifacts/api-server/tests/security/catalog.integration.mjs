import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";

if (!process.env.SENDFLOW_ISOLATED_RUNTIME || !process.env.SENDFLOW_FIXTURE_SOCKET) {
  throw new Error("This suite must run through the disposable PostgreSQL runner.");
}
const require = createRequire(import.meta.url);
const runtime = require(process.env.SENDFLOW_ISOLATED_RUNTIME);
const { pool } = runtime;
let server, base;

before(async () => {
  const app = runtime.express();
  app.use(runtime.express.json());
  app.use((req, _res, next) => { req.log = { error() {} }; next(); });
  app.use("/public", runtime.countryManagementRouter);
  app.use("/public", runtime.operatorPricingRouter);
  app.use("/secure-catalog", runtime.createAdminCountryRoutes(() => "fixture-catalog-admin"));
  app.use("/secure-catalog", runtime.createAdminAggregatorRoutes(() => "fixture-catalog-admin"));
  // Default factories retain the real, deny-by-default authorization.
  app.use("/denied", runtime.createAdminCountryRoutes());
  app.use("/denied", runtime.createAdminAggregatorRoutes());
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function call(path, method = "GET", data) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const countryInput = (code) => ({
  countryCode: code, countryName: `Fixture ${code}`, phonePrefix: "+991",
  minPhoneDigits: 8, maxPhoneDigits: 8, enabled: true, reason: "Isolated catalog fixture",
});

test("catalog administration stays closed without real authorization", async () => {
  for (const path of ["/denied/countries", "/denied/payment-routing"]) {
    assert.ok([401, 403, 503].includes((await call(path)).status));
  }
  assert.ok([401, 403, 503].includes((await call("/denied/countries", "POST", countryInput("xx"))).status));
});

test("countries: validated creation, public visibility, version conflict and atomic audit", async () => {
  assert.equal((await call("/secure-catalog/countries", "POST", { ...countryInput("zz"), minPhoneDigits: 10 })).status, 400);
  assert.equal((await call("/secure-catalog/countries", "POST", { ...countryInput("zz"), maxPhoneDigits: 15 })).status, 400);
  const created = await call("/secure-catalog/countries", "POST", countryInput("zz"));
  assert.equal(created.status, 201);
  assert.deepEqual(created.data.operations, { deposit: false, interNetwork: false, international: false });
  assert.equal((await call("/secure-catalog/countries", "POST", countryInput("zz"))).status, 409);
  assert.equal((await call("/secure-catalog/countries", "POST", countryInput("yy"))).status, 201);
  const changes = {
    countryName: "Fixture ZZ updated", phonePrefix: "+991", minPhoneDigits: 8, maxPhoneDigits: 8,
    enabled: true, operations: { deposit: true, interNetwork: false, international: true },
    expectedVersion: created.data.version, reason: "Enable selected isolated operations",
  };
  assert.equal((await call("/secure-catalog/countries/zz", "PATCH", changes)).status, 200);
  assert.equal((await call("/secure-catalog/countries/zz", "PATCH", changes)).status, 409);
  const countries = (await call("/public/auth/countries")).data.countries;
  assert.equal(countries.find((country) => country.countryCode === "zz").countryName, changes.countryName);
  assert.deepEqual(countries.find((country) => country.countryCode === "yy").operations,
    { deposit: false, interNetwork: false, international: false });
  const audits = await pool.query(`SELECT action FROM sf_admin_audit_logs
    WHERE resource_type='country' AND resource_id='zz'`);
  assert.ok(audits.rows.some((row) => row.action === "create_country"));
  assert.ok(audits.rows.some((row) => row.action === "update_country"));
});

test("routing: operation/country isolation, override, switching, stale writes and concurrent uniqueness", async () => {
  for (const code of ["zz", "yy"]) {
    await pool.query(`INSERT INTO sf_operator_catalog
      (operator_id,country_code,name,short_name,initials,brand,enabled,
       deposit_enabled,inter_network_enabled,international_enabled,created_by,updated_by)
      VALUES ($1,$2,$3,'Fixture','FX','generic',true,true,true,false,'fixture','fixture')`,
    [`catalog-operator-${code}`, code, `Fixture operator ${code}`]);
  }
  for (const code of ["catalog-a", "catalog-b"]) {
    const created = await call("/secure-catalog/payment-aggregators", "POST",
      { code, name: code, reason: "Isolated provider metadata" });
    assert.equal(created.status, 201);
    const enabled = await call("/secure-catalog/payment-aggregators", "PATCH",
      { code, name: code, enabled: true, expectedVersion: created.data.version, reason: "Isolated activation" });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.data.adapterStatus, "not_implemented");
  }
  const route = (operation, extra = {}) => ({
    scopeType: "country", countryCode: "zz", operation, operatorId: null,
    aggregatorCode: "catalog-a", expectedVersion: 0, reason: "Isolated routing update", ...extra,
  });
  assert.equal((await call("/secure-catalog/payment-aggregator-routes", "PUT", route("invalid"))).status, 400);
  assert.equal((await call("/secure-catalog/payment-aggregator-routes", "PUT", route("deposit"))).status, 200);
  assert.equal((await call("/secure-catalog/payment-aggregator-routes", "PUT",
    route("international", { aggregatorCode: "catalog-b" }))).status, 200);
  assert.equal((await call("/secure-catalog/payment-aggregator-routes", "PUT",
    route("deposit", { scopeType: "operator", operatorId: "catalog-operator-yy" }))).status, 404);
  const override = route("deposit", {
    scopeType: "operator", operatorId: "catalog-operator-zz", aggregatorCode: "catalog-b",
  });
  assert.equal((await call("/secure-catalog/payment-aggregator-routes", "PUT", override)).status, 200);
  const routes = (await call("/secure-catalog/payment-routing")).data.countries;
  const deposit = routes.find((row) => row.countryCode === "zz" && row.operation === "deposit");
  assert.equal(deposit.defaultAggregatorCode, "catalog-a");
  assert.equal(deposit.operators[0].effectiveAggregatorCode, "catalog-b");
  assert.equal(deposit.operators[0].inheritsCountryDefault, false);
  const international = routes.find((row) => row.countryCode === "zz" && row.operation === "international");
  assert.equal(international.operators[0].effectiveAggregatorCode, "catalog-b");
  assert.equal(international.operators[0].inheritsCountryDefault, true);
  assert.ok(routes.filter((row) => row.countryCode === "yy").every((row) => row.defaultAggregatorCode === null));
  const switchInput = { ...override, aggregatorCode: "catalog-a", expectedVersion: 1 };
  assert.equal((await call("/secure-catalog/payment-aggregator-routes", "PUT", switchInput)).status, 200);
  assert.equal((await call("/secure-catalog/payment-aggregator-routes", "PUT", switchInput)).status, 409);
  const simultaneous = await Promise.all([
    call("/secure-catalog/payment-aggregator-routes", "PUT", route("inter-network")),
    call("/secure-catalog/payment-aggregator-routes", "PUT", route("inter-network", { aggregatorCode: "catalog-b" })),
  ]);
  assert.deepEqual(simultaneous.map((result) => result.status).sort(), [200, 409]);
  const stored = await pool.query(`SELECT count(*)::int AS n FROM sf_operation_aggregator_routes
    WHERE scope_type='country' AND scope_key='zz' AND operation='inter-network'`);
  assert.equal(stored.rows[0].n, 1);
});

test("public availability is server-computed per country and per operation", async () => {
  const response = await call("/public/pricing");
  assert.equal(response.status, 200);
  const zz = response.data.operators.find((operator) => operator.id === "catalog-operator-zz");
  assert.deepEqual(zz.operations, { deposit: true, interNetwork: false, international: false });
  const yy = response.data.operators.find((operator) => operator.id === "catalog-operator-yy");
  assert.deepEqual(yy.operations, { deposit: false, interNetwork: false, international: false });
});
