import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSiteServer } from "./site-server.ts";

const gatePath = "/secure-entry-for-sendflow-test-only-947362";
const gateToken = "fixture-only-token-not-a-production-secret-298471";

async function fixture(t, configureGate = true) {
  const root = await mkdtemp(join(tmpdir(), "sendflow-site-server-"));
  await mkdir(join(root, "public", "assets"), { recursive: true });
  await mkdir(join(root, "admin", "assets"), { recursive: true });
  await writeFile(join(root, "public", "index.html"), "<!doctype html><title>SendFlow</title>");
  await writeFile(join(root, "public", "assets", "app.js"), "window.sendflowLoaded = true;");
  await writeFile(join(root, "admin", "index.html"), "<!doctype html><title>Private access surface</title><script src=\"/__sendflow_private_bundle__/assets/private.js\"></script>");
  await writeFile(join(root, "admin", "assets", "private.js"), "window.privateAccessLoaded = true;");

  const previousAdminPath = process.env.ADMIN_SECRET_PATH;
  const previousAdminToken = process.env.ADMIN_SECRET_TOKEN;
  if (configureGate) {
    process.env.ADMIN_SECRET_PATH = gatePath;
    process.env.ADMIN_SECRET_TOKEN = gateToken;
  } else {
    delete process.env.ADMIN_SECRET_PATH;
    delete process.env.ADMIN_SECRET_TOKEN;
  }

  const server = createSiteServer(
    root,
    async () => true,
  );
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    if (previousAdminPath === undefined) delete process.env.ADMIN_SECRET_PATH;
    else process.env.ADMIN_SECRET_PATH = previousAdminPath;
    if (previousAdminToken === undefined) delete process.env.ADMIN_SECRET_TOKEN;
    else process.env.ADMIN_SECRET_TOKEN = previousAdminToken;
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await rm(root, { recursive: true, force: true });
  });

  return server;
}

function request(server, path, {
  method = "GET",
  host = "merchent.business.sendflow.africa",
  headers = {},
  body,
} = {}) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      path,
      method,
      headers: { host, ...headers },
    }, (response) => {
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        contentType: response.headers["content-type"],
        headers: response.headers,
        body: chunks.join(""),
      }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

function get(server, path, host) {
  return request(server, path, { host });
}

function postGate(server, path, token) {
  const body = new URLSearchParams({ token }).toString();
  return request(server, path, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(Buffer.byteLength(body)),
      origin: "https://merchent.business.sendflow.africa",
      "sec-fetch-site": "same-origin",
    },
    body,
  });
}

test("serves index.html for registered application routes", async (t) => {
  const server = await fixture(t);
  for (const path of ["/", "/sign-in", "/linkflow/new", "/transaction/example-id"]) {
    const response = await get(server, path);
    assert.equal(response.status, 200, path);
    assert.match(response.body, /SendFlow/, path);
  }
});

test("returns a plain server HTTP 404 for unknown application routes", async (t) => {
  const server = await fixture(t);
  const response = await get(server, "/this-page-does-not-exist");
  assert.equal(response.status, 404);
  assert.match(response.contentType, /^text\/plain/);
  assert.equal(response.body, "404 Not Found");
});

test("validates documentation and payment routes against their own domains", async (t) => {
  const server = await fixture(t);

  const docsHome = await get(server, "/", "apis.docs.sendflow.africa");
  assert.equal(docsHome.status, 200);
  const docsPage = await get(server, "/docs/integrations/hosted", "apis.docs.sendflow.africa");
  assert.equal(docsPage.status, 200);
  const missingDocs = await get(server, "/docs/not-a-real-page", "apis.docs.sendflow.africa");
  assert.equal(missingDocs.status, 404);

  const paymentPage = await get(server, "/pay/public-link-token", "payin.merchant.command.sendflow.africa");
  assert.equal(paymentPage.status, 200);
  const missingPaymentPage = await get(server, "/settings", "payin.merchant.command.sendflow.africa");
  assert.equal(missingPaymentPage.status, 404);
});

test("missing assets and API paths never fall through to the SPA", async (t) => {
  const server = await fixture(t);
  for (const path of ["/assets/missing.js", "/api", "/api/missing-route"]) {
    const response = await get(server, path);
    assert.equal(response.status, 404, path);
    assert.equal(response.body, "404 Not Found", path);
  }
});

test("secret path shows only a token challenge until the server validates the token", async (t) => {
  const server = await fixture(t);
  const publicHome = await get(server, "/");
  assert.equal(publicHome.status, 200);
  assert.match(publicHome.body, /<title>SendFlow<\/title>/);
  assert.doesNotMatch(publicHome.body, /Private access surface/i);

  const challenge = await get(server, gatePath);
  assert.equal(challenge.status, 200);
  assert.match(challenge.body, /name="token"/);
  assert.doesNotMatch(challenge.body, /Private access surface/i);
  assert.doesNotMatch(challenge.body, new RegExp(gateToken));
  assert.doesNotMatch(challenge.body, new RegExp(gatePath));

  const invalid = await postGate(server, gatePath, "invalid-token-that-is-not-the-configured-value");
  assert.equal(invalid.status, 404);
  assert.equal(invalid.body, "404 Not Found");
  assert.equal(invalid.headers?.location, undefined);

  const wrongPath = await postGate(server, "/another-secret-route-that-is-invalid-4567", gateToken);
  assert.equal(wrongPath.status, 404);
  assert.equal(wrongPath.body, "404 Not Found");
  assert.equal(wrongPath.headers?.location, undefined);

  const accepted = await postGate(server, gatePath, gateToken);
  assert.equal(accepted.status, 200);
  assert.match(accepted.body, /Private access surface/);
  const setCookie = accepted.headers?.["set-cookie"];
  assert.ok(Array.isArray(setCookie));
  assert.match(setCookie[0], /HttpOnly/u);
  assert.match(setCookie[0], /Secure/u);
  assert.match(setCookie[0], /SameSite=Strict/u);
  assert.doesNotMatch(accepted.body, new RegExp(gateToken));
  assert.doesNotMatch(accepted.body, new RegExp(gatePath));

  const cookie = setCookie[0].split(";", 1)[0];
  const privateEntry = await request(server, gatePath, { headers: { cookie } });
  assert.equal(privateEntry.status, 200);
  assert.match(privateEntry.body, /Private access surface/);
  const privateAsset = await request(server, "/__sendflow_private_bundle__/assets/private.js", {
    headers: { cookie },
  });
  assert.equal(privateAsset.status, 200);
  assert.match(privateAsset.body, /privateAccessLoaded/);
  assert.equal((await get(server, "/__sendflow_private_bundle__/assets/private.js")).status, 404);

  for (const path of ["/admin", "/admin/sign-in", "/__sendflow_private_bundle__/assets/private.js"]) {
    const response = await get(server, path);
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(response.body, /Private access surface/i, path);
  }
});

test("repeated invalid tokens receive only the generic not-found response", async (t) => {
  const server = await fixture(t);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await postGate(server, gatePath, `invalid-fixture-${attempt}-not-valid`);
    assert.equal(response.status, 404);
    assert.equal(response.body, "404 Not Found");
    assert.equal(response.headers?.location, undefined);
  }
});

test("missing gate secrets fail closed for the private entry and its assets", async (t) => {
  const server = await fixture(t, false);
  assert.equal((await get(server, gatePath)).status, 404);
  assert.equal((await get(server, "/__sendflow_private_bundle__/assets/private.js")).status, 404);
});
