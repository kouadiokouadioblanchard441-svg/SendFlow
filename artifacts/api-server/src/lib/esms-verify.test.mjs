import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEsmsVerifyClient,
  EsmsConfigurationError,
  EsmsRateLimitError,
} from "./esms-verify.ts";

function makeClient(responses) {
  const requests = [];
  const fetchImpl = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error("No stub response configured");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: next.headers,
    });
  };

  const client = createEsmsVerifyClient({
    apiKey: "esms_test_fake-key",
    appId: "vera_sendflow_test",
    fetchImpl,
  });

  return { client, requests };
}

test("rejects missing or unsupported eSMS credentials", () => {
  assert.throws(
    () => createEsmsVerifyClient({ apiKey: undefined, appId: "vera_sendflow_test" }),
    EsmsConfigurationError,
  );
  assert.throws(
    () => createEsmsVerifyClient({ apiKey: "unprefixed-test-key", appId: "vera_sendflow_test" }),
    EsmsConfigurationError,
  );
  assert.throws(
    () => createEsmsVerifyClient({ apiKey: "esms_test_fake-key", appId: "" }),
    EsmsConfigurationError,
  );
});

test("starts verification using the server-side app id and bearer key", async () => {
  const { client, requests } = makeClient([
    { body: { verification_id: "verify_123", status: "pending" } },
  ]);

  assert.deepEqual(await client.start("+2250102030405"), { verificationId: "verify_123" });
  assert.equal(requests[0].url, "https://sms.esmsafrica.io/api/verify/start");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.Authorization, "Bearer esms_test_fake-key");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    to: "+2250102030405",
    app_id: "vera_sendflow_test",
  });
});

test("checks the exact provider verification id and distinguishes approved codes", async () => {
  const { client, requests } = makeClient([
    { body: { status: "approved" } },
    { body: { status: "pending" } },
  ]);

  assert.deepEqual(await client.check("verify_123", "123456"), { approved: true });
  assert.deepEqual(await client.check("verify_123", "000000"), { approved: false });
  assert.equal(requests[0].url, "https://sms.esmsafrica.io/api/verify/check");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    verification_id: "verify_123",
    code: "123456",
  });
});

test("treats provider invalid-code responses as a rejected check", async () => {
  const { client } = makeClient([
    { status: 422, body: { error: "invalid code" } },
  ]);

  assert.deepEqual(await client.check("verify_123", "000000"), { approved: false });
});

test("returns provider rate limits with a bounded retry delay", async () => {
  const { client } = makeClient([
    {
      status: 429,
      body: { error: "rate limited" },
      headers: { "retry-after": "42" },
    },
  ]);

  await assert.rejects(
    () => client.start("+2250102030405"),
    (error) => error instanceof EsmsRateLimitError && error.retryAfterSeconds === 42,
  );
});