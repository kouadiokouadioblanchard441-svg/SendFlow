import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
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
let turnstileTokenSequence = 0;
const turnstileTokens = new Map();
const usedTurnstileTokens = new Set();

function createTurnstileTestToken(action) {
  const token = `isolated-admin-${action}-${++turnstileTokenSequence}`;
  turnstileTokens.set(token, action);
  return token;
}

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
    (phone_hash,email_hash,requester_hash,purpose,delivery_channel,status,phone_verified,email_verified,verified_at,expires_at,resend_after)
    VALUES($1,$2,$3,$4,'email','verified',false,true,now(),now()+$5::interval,now()) RETURNING id`,
  [runtime.fingerprint(`phone:${phones[user]}`), runtime.fingerprint(`email:${user}`),
    runtime.fingerprint(`requester:${requester}`), purpose,
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
async function withMockedEmailProvider(action) {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldFetch = globalThis.fetch;
  const sentRequests = [];
  process.env.NODE_ENV = "production";
  globalThis.fetch = async (url, init) => {
    if (String(url) === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
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
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url) !== "https://api.resend.com/emails") {
      throw new Error("External network forbidden");
    }
    sentRequests.push({ url, init });
    return new Response(JSON.stringify({ id: `isolated-email-message-${sentRequests.length}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    return await action(sentRequests);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
  }
}
async function sendOtp(body) {
  return withMockedEmailProvider(async (sentRequests) => {
    const action = body.purpose === "signup"
      ? "signup"
      : body.purpose === "password_reset"
        ? "password_reset"
        : undefined;
    const requestBody = action
      ? { ...body, turnstileToken: createTurnstileTestToken(action) }
      : body;
    const response = await request("/auth/send-otp", { method: "POST", body: requestBody });
    const sentRequest = sentRequests[0];
    const emailPayload = sentRequest ? JSON.parse(sentRequest.init.body) : null;
    const code = emailPayload?.text.match(/\b([0-9]{6})\b/)?.[1] ?? null;
    return { response, sentRequest, emailPayload, code, sentRequests };
  });
}
async function sendSignupOtp(phone, email) {
  return sendOtp({ phone, email, purpose: "signup" });
}
async function setUserEmail(userId, email, verified) {
  const normalizedEmail = email.trim().toLowerCase();
  const emailLookupHash = runtime.createSensitiveDataLookupIndex(normalizedEmail, "user-email");
  const emailEncrypted = runtime.encryptSensitiveData(normalizedEmail, "user-email");
  await owner.query(
    "UPDATE sf_users SET email_encrypted=$1,email_lookup_hash=$2,email_verified_at=$3 WHERE id=$4",
    [emailEncrypted, emailLookupHash, verified ? new Date() : null, userId],
  );
}
async function clearOtpChallenge(challengeId) {
  await owner.query("DELETE FROM sf_phone_otp_challenges WHERE id=$1", [challengeId]);
  await clearAttempts();
}
async function clearOtpFixture(phone) {
  await owner.query("DELETE FROM sf_phone_otp_challenges WHERE phone_hash=$1", [
    runtime.fingerprint(`phone:${phone}`),
  ]);
  await clearAttempts();
}

before(async () => {
  // No fetch transport can call email delivery or any other provider during these tests.
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
  const linkFlowPricingMigration = readFileSync(
    new URL("../../../../lib/db/migrations/2026-10-26-linkflow-pricing-rates.sql", import.meta.url),
    "utf8",
  );
  await owner.query(`INSERT INTO sf_operator_catalog
    (operator_id,country_code,name,short_name,initials,brand,enabled,created_by,updated_by)
    VALUES('fixture-empty-operator','ci','Sans tarif dépôt','Sans tarif','ST','generic',false,'fixture','fixture')`);
  await owner.query(linkFlowPricingMigration);
  await owner.query(linkFlowPricingMigration);
  const seededLinkFlowRate = await owner.query(
    "SELECT fee_percent,version FROM sf_operator_pricing_rates WHERE operator_id='fixture-operator' AND category_id='linkflow'",
  );
  assert.equal(seededLinkFlowRate.rows[0].fee_percent, null);
  assert.equal(seededLinkFlowRate.rows[0].version, 1);
  const emptyLinkFlowRate = await owner.query(
    "SELECT fee_percent,version FROM sf_operator_pricing_rates WHERE operator_id='fixture-empty-operator' AND category_id='linkflow'",
  );
  assert.equal(emptyLinkFlowRate.rows[0].fee_percent, null);
  assert.equal(emptyLinkFlowRate.rows[0].version, 1);
  const app = runtime.express();
  app.use((req, _res, next) => { req.log = { error() {}, warn() {}, info() {} }; next(); });
  app.use(runtime.express.json());
  const surface = runtime.express.Router();
  surface.use(runtime.loadAdminSession, runtime.accessRouter, runtime.pricingRouter, runtime.logoRouter);
  surface.use(runtime.otpRouter);
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
test("signup email OTP is sent and verified without verifying the phone", async () => {
  const phone = "+2250700000014";
  const email = "otp-fixture@example.invalid";
  try {
    const { response: sent, sentRequest, emailPayload, code } = await sendSignupOtp(phone, email);
    assert.equal(sent.status, 202);
    assert.equal(sent.body.resendAfterSeconds, 60);
    assert.equal("code" in sent.body, false);
    const expiresAt = new Date(sent.body.expiresAt).getTime();
    assert.ok(expiresAt > Date.now());
    assert.ok(expiresAt <= Date.now() + 5 * 60 * 1000 + 1000);
    assert.equal(sentRequest.url, "https://api.resend.com/emails");
    assert.deepEqual(emailPayload.to, ["otp-fixture@example.invalid"]);
    assert.ok(code);

    const cooldown = await sendSignupOtp(phone, email);
    assert.equal(cooldown.response.status, 429);
    assert.equal(cooldown.sentRequests.length, 0);

    const wrongPurpose = await request("/auth/verify-otp", {
      method: "POST",
      body: { challengeId: sent.body.challengeId, purpose: "pin_reset", code },
    });
    assert.equal(wrongPurpose.status, 409);

    const reserved = await owner.query(
      "SELECT delivery_channel,status,phone_verified,email_verified,code_hash,provider_message_id FROM sf_phone_otp_challenges WHERE id=$1",
      [sent.body.challengeId],
    );
    assert.equal(reserved.rows[0].delivery_channel, "email");
    assert.equal(reserved.rows[0].status, "pending");
    assert.equal(reserved.rows[0].phone_verified, false);
    assert.equal(reserved.rows[0].email_verified, false);
    assert.notEqual(reserved.rows[0].code_hash, code);
    assert.equal(reserved.rows[0].provider_message_id, "isolated-email-message-1");

    const verificationResponses = await Promise.all([0, 1].map(() => request("/auth/verify-otp", {
      method: "POST",
      body: { challengeId: sent.body.challengeId, purpose: "signup", code },
    })));
    assert.ok(verificationResponses.some((response) => response.status === 200));
    assert.ok(verificationResponses.every((response) => [200, 409].includes(response.status)));

    const stored = await owner.query(
      "SELECT status,phone_verified,email_verified,code_hash FROM sf_phone_otp_challenges WHERE id=$1",
      [sent.body.challengeId],
    );
    assert.equal(stored.rows[0].status, "verified");
    assert.equal(stored.rows[0].phone_verified, false);
    assert.equal(stored.rows[0].email_verified, true);
    assert.equal(stored.rows[0].code_hash, null);
    const verifiedEvents = await owner.query(
      "SELECT count(*)::int AS count FROM sf_phone_otp_events WHERE challenge_id=$1 AND outcome='verified'",
      [sent.body.challengeId],
    );
    assert.equal(verifiedEvents.rows[0].count, 1);
  } finally {
    await clearOtpFixture(phone);
  }
});
test("OTP verification expires and erases the code hash", async () => {
  const phone = "+2250700000021";
  try {
    const { response: sent, code } = await sendSignupOtp(phone, "otp-expired@example.invalid");
    assert.equal(sent.status, 202);
    assert.ok(code);
    await owner.query(
      "UPDATE sf_phone_otp_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",
      [sent.body.challengeId],
    );
    const response = await request("/auth/verify-otp", {
      method: "POST",
      body: { challengeId: sent.body.challengeId, purpose: "signup", code },
    });
    assert.equal(response.status, 409);
    const { rows } = await owner.query(
      "SELECT status,code_hash FROM sf_phone_otp_challenges WHERE id=$1",
      [sent.body.challengeId],
    );
    assert.equal(rows[0].status, "expired");
    assert.equal(rows[0].code_hash, null);
  } finally {
    await clearOtpFixture(phone);
  }
});
test("signup OTP locks after three incorrect codes", async () => {
  const phone = "+2250700000022";
  try {
    const { response: sent, code } = await sendSignupOtp(phone, "otp-locked@example.invalid");
    assert.equal(sent.status, 202);
    assert.ok(code);
    const wrongCode = code === "000000" ? "000001" : "000000";
    const responses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      responses.push(await request("/auth/verify-otp", {
        method: "POST",
        body: { challengeId: sent.body.challengeId, purpose: "signup", code: wrongCode },
      }));
    }
    assert.deepEqual(responses.map((response) => response.status), [400, 400, 429]);
    const { rows } = await owner.query(
      "SELECT status,check_attempts,code_hash FROM sf_phone_otp_challenges WHERE id=$1",
      [sent.body.challengeId],
    );
    assert.equal(rows[0].status, "locked");
    assert.equal(rows[0].check_attempts, 3);
    assert.equal(rows[0].code_hash, null);
  } finally {
    await clearOtpFixture(phone);
  }
});
test("unknown password-reset addresses receive no email and keep a generic response", async () => {
  await setUserEmail("customer", "unverified-reset@example.invalid", false);
  const unverified = await sendOtp({
    email: "unverified-reset@example.invalid",
    purpose: "password_reset",
  });
  assert.equal(unverified.response.status, 202);
  assert.equal(unverified.sentRequests.length, 0);
  assert.equal("code" in unverified.response.body, false);
  await clearOtpChallenge(unverified.response.body.challengeId);

  const result = await withMockedEmailProvider(async (sentRequests) => {
    const response = await request("/auth/send-otp", {
      method: "POST",
      body: {
        email: "unknown-reset@example.invalid",
        purpose: "password_reset",
        turnstileToken: createTurnstileTestToken("password_reset"),
      },
    });
    return { response, sentRequests };
  });
  assert.equal(result.response.status, 202);
  assert.equal(result.sentRequests.length, 0);
  assert.equal(typeof result.response.body.challengeId, "string");
  assert.equal("code" in result.response.body, false);
  const { rows } = await owner.query(
    "SELECT status,code_hash FROM sf_phone_otp_challenges WHERE id=$1",
    [result.response.body.challengeId],
  );
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].code_hash, null);
  await clearOtpChallenge(result.response.body.challengeId);
});
test("untrusted origins cannot request OTP email", async () => {
  const result = await withMockedEmailProvider(async (sentRequests) => {
    const response = await request("/auth/send-otp", {
      method: "POST",
      origin: "https://evil.invalid",
      body: {
        phone: "+2250700000023",
        email: "otp-origin@example.invalid",
        purpose: "signup",
      },
    });
    return { response, sentRequests };
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.sentRequests.length, 0);
});
test("concurrent OTP requests create only one active challenge and one delivery", async () => {
  const phone = "+2250700000024";
  const email = "otp-concurrent@example.invalid";
  try {
    const result = await withMockedEmailProvider(async (sentRequests) => {
      const responses = await Promise.all([0, 1].map(() => request("/auth/send-otp", {
        method: "POST",
        body: {
          phone,
          email,
          purpose: "signup",
          turnstileToken: createTurnstileTestToken("signup"),
        },
      })));
      return { responses, sentRequests };
    });
    assert.deepEqual(result.responses.map((response) => response.status).sort(), [202, 429]);
    assert.equal(result.sentRequests.length, 1);
    const active = await owner.query(
      "SELECT count(*)::int AS count FROM sf_phone_otp_challenges WHERE phone_hash=$1 AND status IN ('starting','pending')",
      [runtime.fingerprint(`phone:${phone}`)],
    );
    assert.equal(active.rows[0].count, 1);
  } finally {
    await clearOtpFixture(phone);
  }
});
test("the hourly phone limit blocks a sixth OTP request", async () => {
  const phone = "+2250700000025";
  const phoneHash = runtime.fingerprint(`phone:${phone}`);
  try {
    for (let index = 0; index < 5; index += 1) {
      await owner.query(
        `INSERT INTO sf_phone_otp_challenges
          (phone_hash,email_hash,requester_hash,purpose,delivery_channel,status,phone_verified,email_verified,check_attempts,created_at,expires_at,resend_after)
         VALUES($1,$2,$3,'signup','email','failed',false,false,0,now()-interval '10 minutes',now()+interval '2 minutes',now()-interval '9 minutes')`,
        [
          phoneHash,
          runtime.fingerprint(`otp-history-email:${index}`),
          runtime.fingerprint(`otp-history-requester:${index}`),
        ],
      );
    }
    const result = await sendSignupOtp(phone, "otp-hourly@example.invalid");
    assert.equal(result.response.status, 429);
    assert.equal(result.sentRequests.length, 0);
  } finally {
    await clearOtpFixture(phone);
  }
});
test("password-reset OTP is delivered only to the stored verified email", async () => {
  const email = "password-reset-fixture@example.invalid";
  await setUserEmail("customer", email, true);
  let challengeId;
  try {
    const sent = await sendOtp({ email, purpose: "password_reset" });
    assert.equal(sent.response.status, 202);
    assert.deepEqual(sent.emailPayload.to, [email]);
    assert.ok(sent.code);
    challengeId = sent.response.body.challengeId;
    const verified = await request("/auth/verify-otp", {
      method: "POST",
      body: { challengeId, purpose: "password_reset", code: sent.code },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.emailVerified, true);
    const { rows } = await owner.query(
      "SELECT status,email_verified,phone_verified,code_hash FROM sf_phone_otp_challenges WHERE id=$1",
      [challengeId],
    );
    assert.equal(rows[0].status, "verified");
    assert.equal(rows[0].email_verified, true);
    assert.equal(rows[0].phone_verified, false);
    assert.equal(rows[0].code_hash, null);
  } finally {
    if (challengeId) await clearOtpChallenge(challengeId);
  }
});
test("PIN-reset OTP is sent to the account email and never verifies the phone", async () => {
  const email = "pin-reset-fixture@example.invalid";
  await setUserEmail("reader", email, true);
  let challengeId;
  try {
    const sent = await sendOtp({ phone: phones.reader, purpose: "pin_reset" });
    assert.equal(sent.response.status, 202);
    assert.deepEqual(sent.emailPayload.to, [email]);
    assert.ok(sent.code);
    challengeId = sent.response.body.challengeId;
    const verified = await request("/auth/verify-otp", {
      method: "POST",
      body: { challengeId, purpose: "pin_reset", code: sent.code },
    });
    assert.equal(verified.status, 200);
    const { rows } = await owner.query(
      "SELECT status,email_verified,phone_verified,code_hash FROM sf_phone_otp_challenges WHERE id=$1",
      [challengeId],
    );
    assert.equal(rows[0].status, "verified");
    assert.equal(rows[0].email_verified, true);
    assert.equal(rows[0].phone_verified, false);
    assert.equal(rows[0].code_hash, null);
  } finally {
    if (challengeId) await clearOtpChallenge(challengeId);
  }
});
test("admin login OTP is purpose-bound and consumed by the authenticated sign-in", async () => {
  await owner.query("DELETE FROM sf_phone_otp_challenges WHERE phone_hash=$1", [
    runtime.fingerprint(`phone:${phones.writer}`),
  ]);
  await clearAttempts();
  const email = "admin-login-fixture@example.invalid";
  await setUserEmail("writer", email, true);
  let challengeId;
  try {
    const sent = await sendOtp({ phone: phones.writer, purpose: "admin_login" });
    assert.equal(sent.response.status, 202);
    assert.deepEqual(sent.emailPayload.to, [email]);
    assert.ok(sent.code);
    challengeId = sent.response.body.challengeId;
    const verified = await request("/auth/verify-otp", {
      method: "POST",
      body: { challengeId, purpose: "admin_login", code: sent.code },
    });
    assert.equal(verified.status, 200);
    assert.equal((await login("writer", challengeId)).status, 200);
    assert.equal((await login("writer", challengeId)).status, 403);
    const { rows } = await owner.query(
      "SELECT status,consumed_at,code_hash FROM sf_phone_otp_challenges WHERE id=$1",
      [challengeId],
    );
    assert.equal(rows[0].status, "verified");
    assert.ok(rows[0].consumed_at);
    assert.equal(rows[0].code_hash, null);
  } finally {
    if (challengeId) await clearOtpChallenge(challengeId);
  }
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
  const catalog = await request("/operator-pricing", { cookie });
  assert.equal(catalog.status, 200);
  assert.ok(catalog.body.categories.some((category) => category.id === "linkflow"));
  const body = {
    countryCode: "ci", categoryId: "linkflow", reason: "Fixture LinkFlow rate change",
    updates: [{ operatorId: "fixture-operator", feePercent: 2.5, expectedVersion: 1 }],
  };
  assert.equal((await request("/operator-pricing-rates", { method: "PUT", cookie, body })).status, 200);
  assert.equal((await request("/operator-pricing-rates", { method: "PUT", cookie, body })).status, 409);
  let stored = await owner.query("SELECT fee_percent,version FROM sf_operator_pricing_rates WHERE operator_id='fixture-operator' AND category_id='linkflow'");
  assert.equal(Number(stored.rows[0].fee_percent), 2.5); assert.equal(stored.rows[0].version, 2);
  const deposit = await owner.query("SELECT fee_percent,version FROM sf_operator_pricing_rates WHERE category_id='deposit'");
  assert.equal(Number(deposit.rows[0].fee_percent), 1); assert.equal(deposit.rows[0].version, 1);
  const audit = await owner.query("SELECT admin_user_id FROM sf_admin_audit_logs WHERE action='update_operator_pricing'");
  assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].admin_user_id, "writer");
  await owner.query(`CREATE FUNCTION fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Fixture audit unavailable'; END $$;
    CREATE TRIGGER fixture_reject_audit BEFORE INSERT ON sf_admin_audit_logs FOR EACH ROW EXECUTE FUNCTION fixture_reject_audit()`);
  try {
    body.updates[0] = { operatorId: "fixture-operator", feePercent: 9, expectedVersion: 2 };
    assert.equal((await request("/operator-pricing-rates", { method: "PUT", cookie, body })).status, 503);
    stored = await owner.query("SELECT fee_percent,version FROM sf_operator_pricing_rates WHERE operator_id='fixture-operator' AND category_id='linkflow'");
    assert.equal(Number(stored.rows[0].fee_percent), 2.5); assert.equal(stored.rows[0].version, 2);
    const count = (await owner.query("SELECT count(*) FROM sf_admin_sessions")).rows[0].count;
    assert.equal((await login()).status, 503);
    assert.equal((await owner.query("SELECT count(*) FROM sf_admin_sessions")).rows[0].count, count);
  } finally {
    await owner.query("DROP TRIGGER fixture_reject_audit ON sf_admin_audit_logs; DROP FUNCTION fixture_reject_audit()");
  }
});
test("a newly added operator receives an independent empty rate for every pricing category", async () => {
  const { cookie } = await login();
  await unlock(cookie);
  const response = await request("/operators", {
    method: "POST",
    cookie,
    body: {
      countryCode: "ci",
      name: "Nouveau réseau",
      brand: "generic",
      reason: "Ajouter un opérateur LinkFlow",
    },
  });
  assert.equal(response.status, 201);
  const rates = await owner.query(
    "SELECT category_id,fee_percent FROM sf_operator_pricing_rates WHERE operator_id=$1 ORDER BY category_id",
    [response.body.operatorId],
  );
  assert.deepEqual(rates.rows.map((row) => row.category_id), [
    "deposit", "inter-network", "international", "linkflow",
  ]);
  assert.ok(rates.rows.every((row) => row.fee_percent === null));
  const catalog = await request("/operator-pricing", { cookie });
  const country = catalog.body.countries.find((item) => item.countryCode === "ci");
  assert.ok(country?.operators.some((operator) => operator.operatorId === response.body.operatorId));
  assert.equal(country.enabled, true);
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
test("shared-database preview blocks even an administrator token", async () => {
  const previous = process.env.SENDFLOW_DATABASE_TARGET;
  process.env.SENDFLOW_DATABASE_TARGET = "shared-external";
  try { assert.equal((await request("/access")).status, 503); }
  finally { process.env.SENDFLOW_DATABASE_TARGET = previous; }
});
