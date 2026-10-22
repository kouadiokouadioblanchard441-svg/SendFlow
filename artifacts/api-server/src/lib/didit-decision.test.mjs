import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { retrieveDiditDecision } from "./didit.ts";

test("decision retrieval uses only fixed HTTPS origin, API authentication and bounded non-redirecting GET", async () => {
  const keys = ["NODE_ENV", "DIDIT_API_KEY", "DIDIT_WORKFLOW_ID", "DIDIT_ENVIRONMENT"];
  const before = keys.map(key => process.env[key]);
  const oldFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    process.env.DIDIT_API_KEY = randomBytes(32).toString("hex");
    process.env.DIDIT_WORKFLOW_ID = "fixture-workflow";
    process.env.DIDIT_ENVIRONMENT = "live";
    const decision = { status: "In Review" };
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://verification.didit.me/v3/session/..%2Fother%3Fquery/decision/");
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "error");
      assert.equal(init.headers["x-api-key"], process.env.DIDIT_API_KEY);
      assert.equal(init.signal instanceof AbortSignal, true);
      return new Response(JSON.stringify(decision));
    };
    assert.deepEqual(await retrieveDiditDecision("../other?query"), decision);
    globalThis.fetch = async () => new Response("sensitive-provider-response", { status: 429 });
    await assert.rejects(retrieveDiditDecision("fixture"), error =>
      /429/.test(error.message) && !/sensitive-provider-response/.test(error.message));
    process.env.NODE_ENV = "development";
    globalThis.fetch = async () => { assert.fail("preview must never attempt a network call"); };
    await assert.rejects(retrieveDiditDecision("fixture"), /disabled outside production/);
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, i) => {
      if (before[i] === undefined) delete process.env[key];
      else process.env[key] = before[i];
    });
  }
});
