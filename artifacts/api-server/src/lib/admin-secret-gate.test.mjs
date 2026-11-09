import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { request as httpRequest } from "node:http";
import express from "express";
import { test } from "node:test";
import {
  ADMIN_GATE_COOKIE,
  createAdminGateCookieValue,
  constantTimeSecretMatch,
  getAdminGateConfiguration,
  hasValidAdminGateCookie,
  isAdminApiRequestPath,
  isSameOriginAdminGatePost,
} from "@workspace/admin-gate";
import { requireAdminSecretGate } from "./admin-secret-gate.ts";

const gatePath = "/secure-entry-for-sendflow-api-test-583019";
const gateToken = "fixture-only-token-not-a-production-secret-518203";

async function startApi(t, configureGate = true) {
  const previousPath = process.env.ADMIN_SECRET_PATH;
  const previousToken = process.env.ADMIN_SECRET_TOKEN;
  if (configureGate) {
    process.env.ADMIN_SECRET_PATH = gatePath;
    process.env.ADMIN_SECRET_TOKEN = gateToken;
  } else {
    delete process.env.ADMIN_SECRET_PATH;
    delete process.env.ADMIN_SECRET_TOKEN;
  }

  const app = express();
  app.use(requireAdminSecretGate);
  app.get("/api/healthz", (_req, res) => res.status(200).send("healthy"));
  app.get("/api/admin/sign-in", (_req, res) => res.status(200).send("admin login API"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  t.after(async () => {
    if (previousPath === undefined) delete process.env.ADMIN_SECRET_PATH;
    else process.env.ADMIN_SECRET_PATH = previousPath;
    if (previousToken === undefined) delete process.env.ADMIN_SECRET_TOKEN;
    else process.env.ADMIN_SECRET_TOKEN = previousToken;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return server;
}

function get(server, path, cookie) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return new Promise((resolve, reject) => {
    const headers = cookie ? { cookie } : {};
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      path,
      headers,
    }, (response) => {
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        body: chunks.join(""),
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

test("admin API detection covers normalized and encoded route variants", () => {
  for (const path of [
    "/api/admin",
    "/api/admin/sign-in",
    "/API/ADMIN/sign-in",
    "/api/%61dmin/sign-in",
    "/api%2Fadmin/sign-in",
    "/api%252Fadmin/sign-in",
    "/api/./admin/sign-in",
    "/api/other/../admin/sign-in",
  ]) assert.equal(isAdminApiRequestPath(path), true, path);
  for (const path of ["/api/administer", "/api/public", "/healthz"]) {
    assert.equal(isAdminApiRequestPath(path), false, path);
  }
});

test("unlock POSTs require a matching browser origin", () => {
  assert.equal(
    isSameOriginAdminGatePost("app.example.test", "https://app.example.test", "same-origin", { NODE_ENV: "production" }),
    true,
  );
  assert.equal(
    isSameOriginAdminGatePost("app.example.test", "https://attacker.example.test", "cross-site", { NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    isSameOriginAdminGatePost("app.example.test", undefined, undefined, { NODE_ENV: "production" }),
    false,
  );
});

test("configured secrets are validated and gate cookies expire without revealing values", () => {
  assert.equal(getAdminGateConfiguration({
    ADMIN_SECRET_PATH: "/short",
    ADMIN_SECRET_TOKEN: gateToken,
  }), null);
  assert.equal(getAdminGateConfiguration({
    ADMIN_SECRET_PATH: gatePath,
    ADMIN_SECRET_TOKEN: "too-short",
  }), null);
  assert.equal(constantTimeSecretMatch(gateToken, gateToken), true);
  assert.equal(constantTimeSecretMatch(gateToken, `${gateToken}x`), false);

  const now = 1_800_000_000_000;
  const config = { path: gatePath, token: gateToken };
  const validCookie = createAdminGateCookieValue(
    gateToken,
    now + 1000,
    "A".repeat(32),
  );
  assert.equal(hasValidAdminGateCookie(
    `${ADMIN_GATE_COOKIE}=${validCookie}`,
    { ADMIN_SECRET_PATH: gatePath, ADMIN_SECRET_TOKEN: gateToken },
    now,
  ), true);
  assert.equal(hasValidAdminGateCookie(
    `${ADMIN_GATE_COOKIE}=${validCookie}`,
    { ADMIN_SECRET_PATH: gatePath, ADMIN_SECRET_TOKEN: gateToken },
    now + 1001,
  ), false);
});

test("direct administrative API access is hidden until the gate cookie is valid", async (t) => {
  const server = await startApi(t);
  for (const path of ["/api/admin/sign-in", "/API/ADMIN/sign-in", "/api/%61dmin/sign-in"]) {
    const denied = await get(server, path);
    assert.equal(denied.status, 404, path);
    assert.equal(denied.body, "404 Not Found", path);
  }

  const config = getAdminGateConfiguration(process.env);
  assert.ok(config);
  const gateCookie = `${ADMIN_GATE_COOKIE}=${createAdminGateCookieValue(config.token)}`;
  const allowedPastGate = await get(server, "/api/admin/sign-in", gateCookie);
  assert.equal(allowedPastGate.status, 200);
  assert.equal(allowedPastGate.body, "admin login API");
  assert.equal((await get(server, "/api/healthz")).status, 200);
});

test("missing or tampered gate configuration fails closed", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const server = await startApi(t, false);
  assert.equal((await get(server, "/api/admin/sign-in")).status, 404);
  assert.equal(getAdminGateConfiguration(process.env), null);
  assert.equal(hasValidAdminGateCookie(
    `${ADMIN_GATE_COOKIE}=arbitrary.invalid`,
    { ADMIN_SECRET_PATH: gatePath, ADMIN_SECRET_TOKEN: gateToken },
  ), false);
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test("the existing administrative API still requires its session and step-up middleware", async () => {
  const source = await readFile(
    path.resolve(import.meta.dirname, "../routes/index.ts"),
    "utf8",
  );
  assert.match(source, /adminSurface\.use\(adminNetworkGuard\)/u);
  assert.match(source, /adminSurface\.use\(loadAdminSession\)/u);
  assert.match(source, /adminSurface\.use\(requireAdminStepUp\)/u);
  assert.match(source, /adminSurface\.use\(adminHandlers\)/u);
  assert.ok(
    source.indexOf("adminSurface.use(loadAdminSession)")
      < source.indexOf("adminSurface.use(adminHandlers)"),
  );
});
