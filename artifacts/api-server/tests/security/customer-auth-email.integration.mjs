import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import http from "node:http";

const runtimePath = process.env.SENDFLOW_ISOLATED_RUNTIME;
const socket = process.env.SENDFLOW_FIXTURE_SOCKET;
if (!runtimePath?.includes("/sendflow-isolated-finance-") || !socket?.includes("/sendflow-isolated-finance-")) {
  throw new Error("Run via run-isolated-finance.mjs; a disposable database is mandatory");
}

const turnstileActions = new Map();
const consumedTurnstileTokens = new Set();
const deliveredCodes = new Map();
let providerCalls = 0;
process.env.TURNSTILE_SECRET_KEY = "isolated-test-turnstile-secret";

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    providerCalls += 1;
    const form = new URLSearchParams(init?.body);
    assert.equal(form.get("secret"), process.env.TURNSTILE_SECRET_KEY);
    const token = form.get("response");
    const action = turnstileActions.get(token);
    if (!token || !action || consumedTurnstileTokens.has(token)) {
      return new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    consumedTurnstileTokens.add(token);
    return new Response(JSON.stringify({
      success: true,
      hostname: "sendflow-test.invalid",
      action,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  if (url === "https://api.resend.com/emails") {
    providerCalls += 1;
    const message = JSON.parse(init?.body ?? "{}");
    assert.equal(message.to?.length, 1);
    const code = message.text?.match(/Votre code de vérification :\s*(\d{6})/u)?.[1];
    assert.ok(code, "the mocked email contains a six-digit OTP");
    deliveredCodes.set(message.to[0], code);
    return new Response(JSON.stringify({ id: `fixture-${randomUUID()}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  throw new Error("External network is forbidden in this suite");
};

const runtime = createRequire(import.meta.url)(runtimePath);
const { app, pool } = runtime;
let server;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

function rawRequest(path, { method = "GET", body, headers = {} } = {}) {
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: {
        Origin: "https://sendflow-test.invalid",
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

function headerValue(headers, name) {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

async function request(path, { method = "GET", body, cookie } = {}) {
  let requestBody = body;
  if (method !== "GET" && requestBody && typeof requestBody === "object") {
    let action;
    if (path === "/api/auth/register") action = "signup";
    else if (path === "/api/auth/sign-in") action = "login";
    else if (path === "/api/auth/reset-password") action = "password_reset";
    else if (path === "/api/auth/send-otp" && ["signup", "password_reset"].includes(body.purpose)) {
      action = body.purpose;
    } else if (path === "/api/auth/verify-otp") action = body.purpose;

    if (action && !Object.hasOwn(requestBody, "turnstileToken")) {
      const token = `isolated-${randomUUID()}`;
      turnstileActions.set(token, action);
      requestBody = { ...requestBody, turnstileToken: token };
    }
  }

  if (method === "GET") return rawRequest(path, { method, headers: cookie ? { Cookie: cookie } : {} });

  const bootstrap = await rawRequest("/api/auth/session", {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const csrfToken = headerValue(bootstrap.headers, "x-csrf-token");
  assert.equal(typeof csrfToken, "string", "the isolated API issues a CSRF token");
  const csrfCookie = (headerValue(bootstrap.headers, "set-cookie") ?? [])
    .find((entry) => entry.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  assert.ok(csrfCookie, "the isolated API sets its CSRF cookie");
  return rawRequest(path, {
    method,
    body: requestBody,
    headers: {
      Cookie: [cookie, csrfCookie].filter(Boolean).join("; "),
      "X-CSRF-Token": csrfToken,
    },
  });
}

function responseBody(response) {
  return JSON.parse(response.text);
}

function sessionCookie(response) {
  const setCookies = headerValue(response.headers, "set-cookie") ?? [];
  const value = setCookies.find((entry) => entry.startsWith("__Host-sendflow_session="));
  assert.ok(value, "successful sign-in sets a customer session cookie");
  return value.split(";")[0];
}

function getDeliveredCode(email) {
  const code = deliveredCodes.get(email);
  assert.ok(code, `a test OTP was delivered for ${email}`);
  return code;
}

test("email signup, password recovery, and phone-addressed PIN recovery work on the repaired schema", async () => {
  const email = "signup.e2e@example.invalid";
  const phone = "+2250102030405";
  const initialPassword = "Fixture-Initial-Password";
  const recoveredPassword = "Fixture-Recovered-Password";

  const signupOtp = await request("/api/auth/send-otp", {
    method: "POST",
    body: { phone, email, purpose: "signup" },
  });
  assert.equal(signupOtp.status, 202, signupOtp.text);
  const signupChallengeId = responseBody(signupOtp).challengeId;

  const signupVerification = await request("/api/auth/verify-otp", {
    method: "POST",
    body: {
      challengeId: signupChallengeId,
      purpose: "signup",
      code: getDeliveredCode(email),
    },
  });
  assert.equal(signupVerification.status, 200, signupVerification.text);
  assert.equal(responseBody(signupVerification).emailVerified, true);

  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      challengeId: signupChallengeId,
      phone,
      email,
      fullName: "Fixture Customer",
      birthDate: "1985-04-12",
      countryCode: "ci",
      password: initialPassword,
      acceptedPrivacy: true,
    },
  });
  assert.equal(registration.status, 201, registration.text);
  const registeredAccount = responseBody(registration);
  assert.equal(registeredAccount.countryCode, "ci");
  assert.equal(registeredAccount.phone, phone);

  const registeredState = (await pool.query(`SELECT u.email_verified_at, u.phone_verified_at,
      c.email_verified, c.phone_verified
    FROM sf_users u
    JOIN sf_phone_otp_challenges c ON c.id=$1
    WHERE u.id=$2`, [signupChallengeId, registeredAccount.userId])).rows[0];
  assert.ok(registeredState.email_verified_at);
  assert.equal(registeredState.phone_verified_at, null);
  assert.equal(registeredState.email_verified, true);
  assert.equal(registeredState.phone_verified, false);

  const signIn = await request("/api/auth/sign-in", {
    method: "POST",
    body: { email, password: initialPassword },
  });
  assert.equal(signIn.status, 200, signIn.text);
  const userSession = sessionCookie(signIn);
  assert.equal(responseBody(signIn).userId, registeredAccount.userId);
  const sessionLookup = await request("/api/auth/session", { cookie: userSession });
  assert.equal(sessionLookup.status, 200, sessionLookup.text);
  assert.equal(responseBody(sessionLookup).userId, registeredAccount.userId);

  // The real per-phone resend cooldown is 60 seconds; expire only this fixture
  // challenge so the phone-addressed recovery path can run in the same test.
  await pool.query(
    "UPDATE sf_phone_otp_challenges SET resend_after=now()-interval '1 minute' WHERE id=$1",
    [signupChallengeId],
  );
  const pinOtp = await request("/api/auth/send-otp", {
    method: "POST",
    body: { phone, purpose: "pin_reset" },
  });
  assert.equal(pinOtp.status, 202, pinOtp.text);
  const pinChallengeId = responseBody(pinOtp).challengeId;
  const pinVerification = await request("/api/auth/verify-otp", {
    method: "POST",
    body: {
      challengeId: pinChallengeId,
      purpose: "pin_reset",
      code: getDeliveredCode(email),
    },
  });
  assert.equal(pinVerification.status, 200, pinVerification.text);
  const pinReset = await request("/api/auth/reset-pin", {
    method: "POST",
    body: { challengeId: pinChallengeId, phone, newPin: "2468" },
  });
  assert.equal(pinReset.status, 200, pinReset.text);
  const afterPinReset = (await pool.query(
    "SELECT phone_verified_at FROM sf_users WHERE id=$1",
    [registeredAccount.userId],
  )).rows[0];
  assert.equal(afterPinReset.phone_verified_at, null);

  const recoverySignIn = await request("/api/auth/sign-in", {
    method: "POST",
    body: { email, password: initialPassword },
  });
  assert.equal(recoverySignIn.status, 200, recoverySignIn.text);
  const recoverySession = sessionCookie(recoverySignIn);

  const recoveryOtp = await request("/api/auth/send-otp", {
    method: "POST",
    body: { email, purpose: "password_reset" },
  });
  assert.equal(recoveryOtp.status, 202, recoveryOtp.text);
  const recoveryChallengeId = responseBody(recoveryOtp).challengeId;
  const recoveryVerification = await request("/api/auth/verify-otp", {
    method: "POST",
    body: {
      challengeId: recoveryChallengeId,
      purpose: "password_reset",
      code: getDeliveredCode(email),
    },
  });
  assert.equal(recoveryVerification.status, 200, recoveryVerification.text);

  const passwordReset = await request("/api/auth/reset-password", {
    method: "POST",
    body: { challengeId: recoveryChallengeId, email, newPassword: recoveredPassword },
  });
  assert.equal(passwordReset.status, 200, passwordReset.text);
  assert.equal(responseBody(passwordReset).success, true);
  const recoveredState = (await pool.query(`SELECT c.consumed_at,
      (SELECT count(*)::int FROM sf_customer_sessions s
       WHERE s.user_id=u.id AND s.revoked_at IS NULL) AS active_sessions
    FROM sf_users u
    JOIN sf_phone_otp_challenges c ON c.id=$1
    WHERE u.id=$2`, [recoveryChallengeId, registeredAccount.userId])).rows[0];
  assert.ok(recoveredState.consumed_at);
  assert.equal(recoveredState.active_sessions, 0);
  const revokedSessionLookup = await request("/api/auth/session", { cookie: recoverySession });
  assert.equal(revokedSessionLookup.status, 401, revokedSessionLookup.text);
  const reusedChallenge = await request("/api/auth/reset-password", {
    method: "POST",
    body: {
      challengeId: recoveryChallengeId,
      email,
      newPassword: "Fixture-Replay-Password",
    },
  });
  assert.equal(reusedChallenge.status, 409, reusedChallenge.text);

  const oldPasswordSignIn = await request("/api/auth/sign-in", {
    method: "POST",
    body: { email, password: initialPassword },
  });
  assert.equal(oldPasswordSignIn.status, 401, oldPasswordSignIn.text);
  const recoveredSignIn = await request("/api/auth/sign-in", {
    method: "POST",
    body: { email, password: recoveredPassword },
  });
  assert.equal(recoveredSignIn.status, 200, recoveredSignIn.text);
  assert.equal(responseBody(recoveredSignIn).userId, registeredAccount.userId);

  assert.equal(providerCalls, 15, "only the expected Turnstile and mocked email requests are made");
});
