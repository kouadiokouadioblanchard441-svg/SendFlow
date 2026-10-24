import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkPortalRouteAccess,
  resolveInternalApiOrigin,
} from "./portal-route-access.ts";
import {
  isPortalRouteRequest,
  PORTAL_ROUTE_PATH,
} from "./portal-route-path.ts";

const request = (cookie) => ({ headers: cookie ? { cookie } : {} });
const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

test("protected portal paths match direct, nested, encoded and base-path requests", () => {
  assert.equal(isPortalRouteRequest(PORTAL_ROUTE_PATH), true);
  assert.equal(isPortalRouteRequest(`${PORTAL_ROUTE_PATH}/pin?source=profile`), true);
  assert.equal(isPortalRouteRequest(`/sendflow${PORTAL_ROUTE_PATH}/pin`, "/sendflow/"), true);
  assert.equal(isPortalRouteRequest("/public/account"), false);
  assert.equal(isPortalRouteRequest(`${PORTAL_ROUTE_PATH}-other`), false);
});

test("a missing customer cookie is denied without contacting the API", async () => {
  let called = false;
  const result = await checkPortalRouteAccess(request(), {
    environment: { SENDFLOW_INTERNAL_API_ORIGIN: "http://127.0.0.1:8080" },
    fetcher: async () => { called = true; return jsonResponse(200, { isAuthorized: true }); },
  });
  assert.equal(result, "not-found");
  assert.equal(called, false);
});

test("only a server-confirmed active grant opens the route and only the cookie is forwarded", async () => {
  let target;
  let options;
  const result = await checkPortalRouteAccess(request("__Host-sendflow_session=opaque"), {
    environment: { SENDFLOW_INTERNAL_API_ORIGIN: "http://127.0.0.1:8080" },
    fetcher: async (url, init) => {
      target = String(url);
      options = init;
      return jsonResponse(200, { isAuthorized: true });
    },
  });
  assert.equal(result, "allowed");
  assert.equal(target, "http://127.0.0.1:8080/api/me/portal-eligibility");
  assert.deepEqual(options.headers, { cookie: "__Host-sendflow_session=opaque" });
  assert.equal(options.method, "GET");
  assert.equal(options.redirect, "manual");
  assert.equal(options.cache, "no-store");
});

test("unauthorized or malformed API responses fail closed as not found", async () => {
  for (const fetcher of [
    async () => jsonResponse(200, { isAuthorized: false }),
    async () => jsonResponse(404, {}),
    async () => jsonResponse(401, {}),
    async () => new Response("<html>unexpected</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
  ]) {
    assert.equal(await checkPortalRouteAccess(request("session=value"), {
      environment: { SENDFLOW_INTERNAL_API_ORIGIN: "http://127.0.0.1:8080" },
      fetcher,
    }), "not-found");
  }
});

test("missing production origin and API failures fail closed", async () => {
  assert.equal(resolveInternalApiOrigin({ NODE_ENV: "production" }), null);
  assert.equal(resolveInternalApiOrigin({
    NODE_ENV: "production",
    SENDFLOW_INTERNAL_API_ORIGIN: "https://api.example.test/base",
  }), null);
  assert.equal(await checkPortalRouteAccess(request("session=value"), {
    environment: { NODE_ENV: "production" },
    fetcher: async () => jsonResponse(200, { isAuthorized: true }),
  }), "unavailable");
  assert.equal(await checkPortalRouteAccess(request("session=value"), {
    environment: { SENDFLOW_INTERNAL_API_ORIGIN: "http://127.0.0.1:8080" },
    fetcher: async () => jsonResponse(503, {}),
  }), "unavailable");
  assert.equal(await checkPortalRouteAccess(request("session=value"), {
    environment: { SENDFLOW_INTERNAL_API_ORIGIN: "http://127.0.0.1:8080" },
    fetcher: async () => { throw new Error("isolated network failure"); },
  }), "unavailable");
});
