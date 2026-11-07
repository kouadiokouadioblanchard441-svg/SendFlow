import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSiteServer } from "./site-server.ts";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "sendflow-site-server-"));
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "index.html"), "<!doctype html><title>SendFlow</title>");
  await writeFile(join(root, "assets", "app.js"), "window.sendflowLoaded = true;");

  const server = createSiteServer(
    root,
    async () => true,
    async () => "allowed",
  );
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await rm(root, { recursive: true, force: true });
  });

  return server;
}

function get(server, path, host = "merchent.business.sendflow.africa") {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      path,
      method: "GET",
      headers: { host },
    }, (response) => {
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        contentType: response.headers["content-type"],
        body: chunks.join(""),
      }));
    });
    request.on("error", reject);
    request.end();
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
