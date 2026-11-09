import assert from "node:assert/strict";
import { request as httpRequest, createServer } from "node:http";
import { test } from "node:test";
import { ADMIN_GATE_COOKIE } from "@workspace/admin-gate";
import { adminDevGatePlugin } from "./admin-dev-gate-plugin.ts";

const gatePath = "/secure-entry-for-sendflow-dev-test-482617";
const gateToken = "fixture-only-token-not-a-production-secret-701593";

async function startDevGate(t) {
  const previousPath = process.env.ADMIN_SECRET_PATH;
  const previousToken = process.env.ADMIN_SECRET_TOKEN;
  process.env.ADMIN_SECRET_PATH = gatePath;
  process.env.ADMIN_SECRET_TOKEN = gateToken;
  let gateMiddleware;
  adminDevGatePlugin("/").configureServer({
    middlewares: {
      use(middleware) {
        gateMiddleware = middleware;
      },
    },
  });
  assert.equal(typeof gateMiddleware, "function");
  const server = createServer((req, res) => {
    gateMiddleware(req, res, () => {
      if (req.url === "/admin.html" && req.method === "GET") {
        res.statusCode = 200;
        res.end("<title>Admin login fixture</title>");
        return;
      }
      res.statusCode = 404;
      res.end("404 Not Found");
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
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

function request(server, path, { method = "GET", body = "", cookie } = {}) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return new Promise((resolve, reject) => {
    const headers = {
      host: "localhost",
      ...(cookie ? { cookie } : {}),
      ...(method === "POST" ? {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": String(Buffer.byteLength(body)),
        origin: "http://localhost",
        "sec-fetch-site": "same-origin",
      } : {}),
    };
    const clientRequest = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      path,
      method,
      headers,
    }, (response) => {
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: chunks.join(""),
      }));
    });
    clientRequest.on("error", reject);
    clientRequest.end(body);
  });
}

test("Vite development cannot expose the login entry through alternate paths", async (t) => {
  const server = await startDevGate(t);
  for (const path of [
    "/admin",
    "/admin/sign-in",
    "/ADMIN",
    "/%61dmin/sign-in",
    "/admin.html",
    "/%61dmin.html",
    "/src/admin-main.tsx",
    "/src/admin-app.tsx",
  ]) {
    const response = await request(server, path);
    assert.equal(response.status, 404, path);
    assert.equal(response.body, "404 Not Found", path);
  }

  const challenge = await request(server, gatePath);
  assert.equal(challenge.status, 200);
  assert.match(challenge.body, /name="token"/u);
  assert.doesNotMatch(challenge.body, /Admin login fixture/u);

  const invalid = await request(server, gatePath, {
    method: "POST",
    body: new URLSearchParams({ token: "invalid-fixture-token-that-is-not-correct" }).toString(),
  });
  assert.equal(invalid.status, 404);
  assert.equal(invalid.body, "404 Not Found");
  assert.equal(invalid.headers.location, undefined);

  const accepted = await request(server, gatePath, {
    method: "POST",
    body: new URLSearchParams({ token: gateToken }).toString(),
  });
  assert.equal(accepted.status, 200);
  assert.match(accepted.body, /Admin login fixture/u);
  const cookie = accepted.headers["set-cookie"]?.[0]?.split(";", 1)[0];
  assert.ok(cookie?.startsWith(`${ADMIN_GATE_COOKIE}=`));
  const directWithGateCookie = await request(server, "/admin.html", { cookie });
  assert.equal(directWithGateCookie.status, 200);
  assert.match(directWithGateCookie.body, /Admin login fixture/u);
});
