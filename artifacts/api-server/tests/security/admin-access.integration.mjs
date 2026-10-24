import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import http from "node:http";
import pg from "pg";

const runtimePath = process.env.SENDFLOW_ISOLATED_RUNTIME;
const socket = process.env.SENDFLOW_FIXTURE_SOCKET;
if (!runtimePath?.includes("/sendflow-isolated-admin-") || !socket?.includes("/sendflow-isolated-admin-")) {
  throw new Error("Run via run-isolated-admin-access.mjs only");
}
const runtime = createRequire(import.meta.url)(runtimePath);
const owner = new pg.Pool({ host: socket, port: 15433, database: "postgres", user: "sf_fixture_owner" });
let server, port, pinHash;
const phones = { writer: "+2250700000011", reader: "+2250700000012", customer: "+2250700000013" };
function request(path, { method = "GET", cookie, body, binary, origin = "https://sendflow-test.invalid" } = {}) {
  return new Promise((resolve, reject) => {
    const data = binary ?? (body === undefined ? undefined : JSON.stringify(body));
    const req = http.request({ hostname: "127.0.0.1", port, path: `/secure-access${path}`, method,
      headers: { origin, ...(cookie ? { cookie } : {}),
        ...(data ? { "content-type": binary ? "image/png" : "application/json", "content-length": Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => text += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
    });
    req.on("error", reject); if (data) req.write(data); req.end();
  });
}
async function challenge(user = "writer", { purpose = "admin_login", requester = "127.0.0.1", expired = false } = {}) {
  const { rows } = await owner.query(`INSERT INTO sf_phone_otp_challenges
    (phone_hash,requester_hash,purpose,status,phone_verified,verified_at,expires_at,resend_after)
    VALUES($1,$2,$3,'verified',true,now(),now()+$4::interval,now()) RETURNING id`,
  [runtime.fingerprint(`phone:${phones[user]}`), runtime.fingerprint(`requester:${requester}`), purpose,
    expired ? "-1 minute" : "5 minutes"]);
  return rows[0].id;
}
async function login(user = "writer", id) {
  const response = await request("/sign-in", { method: "POST", body: {
    phone: phones[user], challengeId: id ?? await challenge(user),
  } });
  return { ...response, cookie: response.headers["set-cookie"]?.[0]?.split(";")[0] };
}
async function unlock(cookie, pin = "48261739") {
  return request("/pin/unlock", { method: "POST", cookie, body: { pin } });
}
async function clearAttempts() { await owner.query("DELETE FROM sf_customer_auth_attempts"); }

before(async () => {
  // No fetch transport can call SMS or any other provider during these tests.
  globalThis.fetch = async () => { throw new Error("External network forbidden"); };
  pinHash = await runtime.hashCustomerSecret("48261739");
  for (const [id, phone] of Object.entries(phones)) {
    await owner.query("INSERT INTO sf_users(id,phone,status) VALUES($1,$2,'active')", [id, phone]);
    if (id !== "customer") await owner.query(
      "INSERT INTO sf_admin_grants(user_id,can_mutate,pin_hash) VALUES($1,$2,$3)", [id, id === "writer", pinHash]);
  }
  await owner.query(`INSERT INTO sf_countries(country_code,country_name,phone_prefix,min_phone_digits,max_phone_digits,created_by,updated_by)
    VALUES('ci','Côte d’Ivoire','+225',10,10,'fixture','fixture')`);
  await owner.query(`INSERT INTO sf_operator_catalog(operator_id,country_code,name,short_name,initials,brand,enabled,created_by,updated_by)
    VALUES('fixture-operator','ci','Fixture','Fixture','FX','generic',true,'fixture','fixture')`);
  for (const category of ["deposit", "inter-network", "international"]) {
    await owner.query(`INSERT INTO sf_operator_pricing_rates(operator_id,country_code,category_id,fee_percent,created_by,updated_by)
      VALUES('fixture-operator','ci',$1,1,'fixture','fixture')`, [category]);
  }
  const app = runtime.express();
  app.use((req, _res, next) => { req.log = { error() {}, warn() {}, info() {} }; next(); });
  app.use(runtime.express.json());
  const surface = runtime.express.Router();
  surface.use(runtime.loadAdminSession, runtime.accessRouter, runtime.pricingRouter, runtime.logoRouter);
  surface.get("/overview", (req, res) => {
    if (runtime.respondAdminAuthError(req, res)) res.json({ allowed: true });
  });
  app.use("/secure-access", surface);
  app.use((_error, _req, res, _next) => res.status(500).json({ error: "Fixture request failed" }));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  port = server.address().port;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await runtime.pool.end(); await owner.end();
});

test("anonymous, customer cookies and forged headers cannot read or mutate the catalogue", async () => {
  assert.equal((await request("/operator-pricing")).status, 401);
  const cookie = `__Host-sendflow_session=${randomBytes(32).toString("base64url")}`;
  assert.equal((await request("/operator-pricing", { cookie })).status, 401);
  assert.equal((await request("/operators/fixture-operator/logo/1", { method: "PUT", cookie, binary: Buffer.from("bad") })).status, 401);
  const response = await login("customer");
  assert.equal(response.status, 403);
  assert.equal(response.cookie, undefined);
  await clearAttempts();
});
test("only fresh requester-bound admin challenges work; OTP replay is refused", async () => {
  for (const options of [{ purpose: "signup" }, { requester: "198.51.100.1" }, { expired: true }]) {
    assert.equal((await login("writer", await challenge("writer", options))).status, 403);
  }
  await clearAttempts();
  const id = await challenge();
  const responses = await Promise.all([login("writer", id), login("writer", id)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 403]);
  const response = responses.find((r) => r.status === 200);
  assert.match(response.headers["set-cookie"][0], /HttpOnly/);
  assert.match(response.headers["set-cookie"][0], /Secure/);
  assert.match(response.headers["set-cookie"][0], /SameSite=Strict/);
  const token = response.cookie.split("=")[1];
  const stored = await owner.query("SELECT token_hash FROM sf_admin_sessions ORDER BY created_at DESC LIMIT 1");
  assert.notEqual(stored.rows[0].token_hash, token);
  assert.equal(stored.rows[0].token_hash, runtime.hashAdminSessionToken(token));
  await clearAttempts();
});
test("PIN gates reads/writes and catalogue grants never open other administration", async () => {
  const { cookie, status } = await login();
  assert.equal(status, 200);
  assert.equal((await request("/operator-pricing", { cookie })).status, 403);
  assert.equal((await unlock(cookie)).status, 200);
  assert.equal((await request("/operator-pricing", { cookie })).status, 200);
  assert.equal((await request("/overview", { cookie })).status, 403);
  assert.equal((await request("/pin/unlock", { method: "POST", cookie, body: { pin: "48261739" }, origin: "https://evil.invalid" })).status, 403);
});
test("reader can browse after PIN but cannot change logos or rates", async () => {
  const { cookie } = await login("reader");
  assert.equal((await unlock(cookie)).status, 200);
  assert.equal((await request("/operator-pricing", { cookie })).status, 200);
  assert.equal((await request("/operator-pricing-rates", { method: "PUT", cookie, body: {} })).status, 403);
  assert.equal((await request("/operators/fixture-operator/logo/1", { method: "PUT", cookie, binary: Buffer.from("bad") })).status, 403);
});
test("writer logo update is versioned and audited; stale writes fail without audit changes", async () => {
  const { cookie } = await login();
  await unlock(cookie);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAoAAAAASUVORK5CYII=", "base64");
  assert.equal((await request("/operators/fixture-operator/logo/1", { method: "PUT", cookie, binary: png })).status, 200);
  const audit = await owner.query("SELECT admin_user_id FROM sf_admin_audit_logs WHERE action='update_operator_logo'");
  assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].admin_user_id, "writer");
  assert.equal((await request("/operators/fixture-operator/logo/1", { method: "PUT", cookie, binary: png })).status, 409);
  assert.equal((await owner.query("SELECT count(*) FROM sf_admin_audit_logs WHERE action='update_operator_logo'")).rows[0].count, "1");
  assert.equal((await request("/operators/fixture-operator/logo/2", { method: "DELETE", cookie })).status, 200);
});
test("writer rates persist with versions; conflicting writes and failed audits roll back", async () => {
  const { cookie } = await login(); await unlock(cookie);
  const body = {
    countryCode: "ci", categoryId: "deposit", reason: "Fixture rate change",
    updates: [{ operatorId: "fixture-operator", feePercent: 2.5, expectedVersion: 1 }],
  };
  assert.equal((await request("/operator-pricing-rates", { method: "PUT", cookie, body })).status, 200);
  assert.equal((await request("/operator-pricing-rates", { method: "PUT", cookie, body })).status, 409);
  let stored = await owner.query("SELECT fee_percent,version FROM sf_operator_pricing_rates WHERE category_id='deposit'");
  assert.equal(Number(stored.rows[0].fee_percent), 2.5); assert.equal(stored.rows[0].version, 2);
  const audit = await owner.query("SELECT admin_user_id FROM sf_admin_audit_logs WHERE action='update_operator_pricing'");
  assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].admin_user_id, "writer");
  await owner.query(`CREATE FUNCTION fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Fixture audit unavailable'; END $$;
    CREATE TRIGGER fixture_reject_audit BEFORE INSERT ON sf_admin_audit_logs FOR EACH ROW EXECUTE FUNCTION fixture_reject_audit()`);
  try {
    body.updates[0] = { operatorId: "fixture-operator", feePercent: 9, expectedVersion: 2 };
    assert.equal((await request("/operator-pricing-rates", { method: "PUT", cookie, body })).status, 503);
    stored = await owner.query("SELECT fee_percent,version FROM sf_operator_pricing_rates WHERE category_id='deposit'");
    assert.equal(Number(stored.rows[0].fee_percent), 2.5); assert.equal(stored.rows[0].version, 2);
    const count = (await owner.query("SELECT count(*) FROM sf_admin_sessions")).rows[0].count;
    assert.equal((await login()).status, 503);
    assert.equal((await owner.query("SELECT count(*) FROM sf_admin_sessions")).rows[0].count, count);
  } finally {
    await owner.query("DROP TRIGGER fixture_reject_audit ON sf_admin_audit_logs; DROP FUNCTION fixture_reject_audit()");
  }
});
test("PIN lockout is shared across sessions and serialized", async () => {
  await clearAttempts();
  const first = await login(), second = await login();
  const results = await Promise.all(Array.from({ length: 7 }, (_, index) => unlock(index % 2 ? first.cookie : second.cookie, "00000000")));
  assert.equal(results.filter((r) => r.status === 403).length, 5);
  assert.equal(results.filter((r) => r.status === 429).length, 2);
  assert.equal((await unlock(first.cookie)).status, 429);
  await clearAttempts();
});
test("grant changes, account suspension, expiry and sign-out invalidate access", async () => {
  const signed = await login(); await unlock(signed.cookie);
  await owner.query("UPDATE sf_admin_grants SET can_mutate=false WHERE user_id='writer'");
  assert.equal((await request("/operator-pricing", { cookie: signed.cookie })).status, 401);
  await owner.query("UPDATE sf_admin_grants SET can_mutate=true WHERE user_id='writer'");
  const suspended = await login(); await unlock(suspended.cookie);
  await owner.query("UPDATE sf_users SET status='suspended' WHERE id='writer'");
  assert.equal((await request("/operator-pricing", { cookie: suspended.cookie })).status, 401);
  await owner.query("UPDATE sf_users SET status='active' WHERE id='writer'");
  const expired = await login(); await unlock(expired.cookie);
  await owner.query("UPDATE sf_admin_sessions SET pin_verified_until=now()-interval '1 minute'");
  assert.equal((await request("/operator-pricing", { cookie: expired.cookie })).status, 403);
  await unlock(expired.cookie);
  assert.equal((await request("/sign-out", { method: "POST", cookie: expired.cookie })).status, 204);
  assert.equal((await request("/operator-pricing", { cookie: expired.cookie })).status, 401);
  const timed = await login(); await unlock(timed.cookie);
  await owner.query("UPDATE sf_admin_sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'");
  assert.equal((await request("/operator-pricing", { cookie: timed.cookie })).status, 401);
  const last = await login(); await unlock(last.cookie);
  await owner.query("UPDATE sf_admin_grants SET revoked_at=now() WHERE user_id='writer'");
  assert.equal((await request("/operator-pricing", { cookie: last.cookie })).status, 401);
});
test("application role cannot promote an account or rewrite audit history", async () => {
  await assert.rejects(runtime.pool.query("UPDATE sf_admin_grants SET can_mutate=true WHERE user_id='reader'"), { code: "42501" });
  await assert.rejects(runtime.pool.query("DELETE FROM sf_admin_audit_logs"), { code: "42501" });
});
test("shared-Neon preview blocks even an administrator token", async () => {
  const previous = process.env.SENDFLOW_DATABASE_TARGET;
  process.env.SENDFLOW_DATABASE_TARGET = "shared-neon";
  try { assert.equal((await request("/access")).status, 503); }
  finally { process.env.SENDFLOW_DATABASE_TARGET = previous; }
});
