import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { FeexpayClient, FeexpayError } from "./client.ts";
import { feexpayChannels, getFeexpayCoverage } from "./catalog.ts";

const receiptReference = randomUUID();
const operationReference = randomBytes(12).toString("hex").toUpperCase();
const sandbox = () => ({
  NODE_ENV: "test", FEEXPAY_MODE: "sandbox",
  FEEXPAY_SANDBOX_API_KEY: `test_key_${randomBytes(24).toString("hex")}`,
  FEEXPAY_SANDBOX_SHOP_ID: randomUUID(),
});
const live = () => ({
  NODE_ENV: "production", FEEXPAY_MODE: "live", FEEXPAY_LIVE_ENABLED: "true",
  SENDFLOW_DATABASE_TARGET: "production",
  FEEXPAY_EXECUTION_HOST: "plesk", FEEXPAY_API_KEY: randomBytes(24).toString("hex"),
  FEEXPAY_SHOP_ID: randomUUID(),
});
const payment = (extra = {}) => ({
  channelId: "mtn-ci", amountMinor: 1000, currency: "XOF",
  phoneNumber: `225${"0".repeat(10)}`, operationReference, ...extra,
});
const response = (extra = {}) => new Response(JSON.stringify({
  reference: receiptReference, status: "PENDING", amount: 1000, ...extra,
}), { headers: { "Content-Type": "application/json" } });
const hasCode = (code) => (error) => error instanceof FeexpayError && error.code === code;

const replitLive = () => ({
  ...live(),
  NODE_ENV: "development",
  FEEXPAY_EXECUTION_HOST: "replit",
  SENDFLOW_DATABASE_TARGET: "shared-neon",
  SENDFLOW_REPLIT_LIVE_APPROVED: "true",
  SENDFLOW_SHARED_NEON_LIVE_APPROVED: "true",
  REPL_ID: randomUUID(),
  REPLIT_DEV_DOMAIN: "workspace.invalid",
  NEON_DATABASE_URL_PRODUCTION: "postgresql://production.invalid/sendflow?sslmode=require",
});

test("approved Replit live uses the real API origin with the connected shared Neon (mocked transport)", async () => {
  for (const operation of ["payin", "payout"]) {
    let calls = 0;
    const client = new FeexpayClient(replitLive(), async (url, init) => {
      calls++;
      assert.equal(new URL(url).origin, "https://api-v2.feexpay.me");
      assert.equal(init.method, "POST");
      return response();
    });
    assert.equal((await client.initiate(operation, payment())).status, "PENDING");
    assert.equal(calls, 1);
  }
});

test("Replit live never dispatches without both approvals, the connected database, runtime identity and its live switch", async () => {
  const variants = [
    { SENDFLOW_REPLIT_LIVE_APPROVED: "false" },
    { SENDFLOW_SHARED_NEON_LIVE_APPROVED: "false" },
    { FEEXPAY_LIVE_ENABLED: "false" },
    { SENDFLOW_DATABASE_TARGET: "production" },
    { SENDFLOW_DATABASE_TARGET: "development" },
    { NODE_ENV: "test" },
    { REPL_ID: undefined },
    { REPLIT_DEV_DOMAIN: undefined },
    { NEON_DATABASE_URL_PRODUCTION: undefined },
    { NEON_DATABASE_URL_PRODUCTION: "postgresql://production.invalid/sendflow?sslmode=disable" },
    { FEEXPAY_EXECUTION_HOST: "unknown" },
  ];
  for (const variant of variants) {
    let calls = 0;
    const client = new FeexpayClient({ ...replitLive(), ...variant }, async () => {
      calls++;
      return response();
    });
    await assert.rejects(client.initiate("payin", payment()), hasCode("LIVE_DISABLED"));
    assert.equal(calls, 0);
  }
});

test("Plesk live requires an explicit production database target", async () => {
  let calls = 0;
  const client = new FeexpayClient({ ...live(), SENDFLOW_DATABASE_TARGET: undefined }, async () => {
    calls++;
    return response();
  });
  await assert.rejects(client.initiate("payin", payment()), hasCode("LIVE_DISABLED"));
  assert.equal(calls, 0);
});

test("six documented countries, 17 payin channels, 16 payout channels; no invented Coris payout", () => {
  const coverage = getFeexpayCoverage();
  assert.deepEqual(coverage.map((c) => c.countryCode), ["BJ", "BF", "CI", "SN", "TG", "CG"]);
  assert.equal(feexpayChannels.length, 17);
  assert.equal(feexpayChannels.filter((c) => c.payoutPath).length, 16);
  assert.equal(new Set(feexpayChannels.map((c) => c.id)).size, 17);
  assert.equal(coverage.find((c) => c.countryCode === "BJ").payoutOperators.includes("Coris"), false);
  assert.equal(coverage.find((c) => c.countryCode === "CG").applicationSupported, false);
});

test("payin request uses pinned sandbox origin, bearer header and server reference", async () => {
  const environment = sandbox();
  let calls = 0;
  const client = new FeexpayClient(environment, async (url, init) => {
    calls++;
    assert.equal(url, "https://sandbox-api.feexpay.me/api/transactions/public/requesttopay/mtn_ci");
    assert.equal(init.headers.Authorization, `Bearer ${environment.FEEXPAY_SANDBOX_API_KEY}`);
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(init.body), {
      shop: environment.FEEXPAY_SANDBOX_SHOP_ID, amount: 1000,
      phoneNumber: payment().phoneNumber, callback_info: operationReference, description: operationReference,
    });
    return response();
  });
  assert.equal((await client.initiate("payin", payment())).status, "PENDING");
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(client), "{}");
});

test("shared Togo payout endpoint carries the correct operator network", async () => {
  for (const [channelId, network] of [["togocom-tg", "TOGOCOM TG"], ["moov-tg", "MOOV TG"]]) {
    const client = new FeexpayClient(sandbox(), async (url, init) => {
      assert.equal(url, "https://sandbox-api.feexpay.me/api/payouts/public/togo");
      assert.equal(JSON.parse(init.body).network, network);
      assert.equal(JSON.parse(init.body).motif, operationReference);
      return response();
    });
    await client.initiate("payout", payment({ channelId, phoneNumber: `228${"0".repeat(8)}` }));
  }
});

// Pin expectations independently of catalog construction: a catalog mutation
// must not make a protocol regression test silently accept the same mutation.
const directChannelContracts = [
  ["mtn-bj", "229", 10, "mtn", "transfer/global", "MTN"],
  ["moov-bj", "229", 10, "moov", "transfer/global", "MOOV"],
  ["celtiis-bj", "229", 10, "celtiis_bj", "celtiis_bj", "CELTIIS BJ"],
  ["coris-bj", "229", 10, "coris", null],
  ["moov-bf", "226", 8, "moov_bf", "moov_bf"],
  ["orange-bf", "226", 8, "orange_bf", "orange_bf"],
  ["wave-bf", "226", 8, "wave_bf", "wave_bf"],
  ["mtn-ci", "225", 10, "mtn_ci", "mtn_ci"],
  ["moov-ci", "225", 10, "moov_ci", "moov_ci"],
  ["orange-ci", "225", 10, "orange_ci", "orange_ci"],
  ["wave-ci", "225", 10, "wave_ci", "wave_ci"],
  ["orange-sn", "221", 9, "orange_sn", "orange_sn"],
  ["free-sn", "221", 9, "free_sn", "free_sn"],
  ["wave-sn", "221", 9, "wave_sn", "wave_sn"],
  ["togocom-tg", "228", 8, "togocom_tg", "togo", "TOGOCOM TG"],
  ["moov-tg", "228", 8, "moov_tg", "togo", "MOOV TG"],
];

for (const [channelId, prefix, digits, payinPath, payoutPath, network] of directChannelContracts) {
  for (const operation of ["payin", "payout"]) {
    if (operation === "payout" && payoutPath === null) continue;
    test(`${channelId} ${operation}: direct live protocol, with synthetic credentials and mocked transport`, async () => {
      const environment = live();
      const input = payment({ channelId, phoneNumber: prefix + "0".repeat(digits), otp: "0".repeat(6) });
      let calls = 0;
      const client = new FeexpayClient(environment, async (url, init) => {
        calls++;
        const suffix = operation === "payin"
          ? `/api/transactions/public/requesttopay/${payinPath}`
          : `/api/payouts/public/${payoutPath}`;
        assert.equal(url, `https://api-v2.feexpay.me${suffix}`);
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Authorization, `Bearer ${environment.FEEXPAY_API_KEY}`);
        assert.equal(init.redirect, "error");
        assert.deepEqual(JSON.parse(init.body), {
          shop: environment.FEEXPAY_SHOP_ID,
          amount: input.amountMinor,
          phoneNumber: input.phoneNumber,
          callback_info: operationReference,
          ...(operation === "payin" ? {
            description: operationReference, otp: input.otp,
          } : {
            motif: operationReference, ...(network ? { network } : {}),
          }),
        });
        return response();
      });
      assert.equal((await client.initiate(operation, input)).status, "PENDING");
      assert.equal(calls, 1);
    });
  }
}

test("Congo Payin and Payout remain blocked for both XAF and XOF before network", async () => {
  const client = new FeexpayClient(live(), async () => assert.fail("No transport for unsupported currency"));
  for (const operation of ["payin", "payout"]) {
    for (const currency of ["XOF", "XAF"]) {
      await assert.rejects(client.initiate(operation, payment({
        channelId: "mtn-cg", phoneNumber: "242" + "0".repeat(9), currency,
      })), hasCode("CURRENCY_UNAVAILABLE"));
    }
  }
});

test("legacy redirect fields are refused even when their HTTPS origin was configured", async () => {
  const client = new FeexpayClient({ ...live(), FEEXPAY_RETURN_ORIGIN: "https://merchant.invalid" },
    async () => assert.fail("Direct REST must not accept redirect options"));
  for (const field of ["returnUrl", "cancelUrl"]) {
    for (const value of [undefined, "https://merchant.invalid/complete"]) {
      await assert.rejects(client.initiate("payin", payment({ [field]: value })), hasCode("INVALID_INPUT"));
    }
  }
});

test("documented v2 status response may omit currency; missing currency is never fabricated", async () => {
  for (const operation of ["payin", "payout"]) {
    const client = new FeexpayClient(live(), async (_url, init) => {
      assert.equal(init.method, "GET");
      return response({ status: "SUCCESSFUL" });
    });
    const receipt = await client.getStatus(operation, receiptReference);
    assert.equal(receipt.status, "SUCCESSFUL");
    assert.equal(receipt.amountMinor, 1000);
    assert.equal(receipt.currency, undefined);
    assert.deepEqual(Object.keys(receipt).sort(), ["amountMinor", "reference", "status"]);
  }
});

test("Plesk configuration fails closed on Replit, preview, development or missing explicit gates", async () => {
  const variants = [
    { NODE_ENV: "development" }, { FEEXPAY_LIVE_ENABLED: "false" },
    { FEEXPAY_EXECUTION_HOST: "replit" }, { SENDFLOW_DATABASE_TARGET: "shared-neon" },
    { REPL_ID: randomUUID() }, { REPLIT_DEV_DOMAIN: "preview.invalid" },
  ];
  for (const variant of variants) {
    let calls = 0;
    const client = new FeexpayClient({ ...live(), ...variant }, async () => { calls++; return response(); });
    await assert.rejects(client.initiate("payin", payment()), hasCode("LIVE_DISABLED"));
    assert.equal(calls, 0);
  }
});

test("sandbox never falls back to live credentials or accepts a non-test key", async () => {
  for (const environment of [
    { ...live(), FEEXPAY_MODE: "sandbox" },
    { ...sandbox(), FEEXPAY_SANDBOX_API_KEY: randomBytes(24).toString("hex") },
    { ...sandbox(), FEEXPAY_MODE: undefined },
  ]) {
    const client = new FeexpayClient(environment, async () => assert.fail("Network must not be reached"));
    await assert.rejects(client.getStatus("payin", receiptReference), hasCode("CONFIGURATION_REQUIRED"));
  }
});

test("unsupported currency, Coris payout, unavailable sandbox channels are rejected before dispatch", async () => {
  const client = new FeexpayClient(sandbox(), async () => assert.fail("Network must not be reached"));
  await assert.rejects(client.initiate("payin", payment({ channelId: "mtn-cg" })), hasCode("CURRENCY_UNAVAILABLE"));
  await assert.rejects(client.initiate("payin", payment({ channelId: "moov-bf" })), hasCode("CHANNEL_UNAVAILABLE"));
  const protocol = new FeexpayClient(live(), async () => assert.fail("Network must not be reached"));
  await assert.rejects(protocol.initiate("payout", payment({ channelId: "coris-bj" })), hasCode("CHANNEL_UNAVAILABLE"));
});

test("amount manipulation, incompatible country, invalid reference/OTP and redirect origins are refused", async () => {
  const client = new FeexpayClient(sandbox(), async () => assert.fail("Network must not be reached"));
  for (const extra of [
    { amountMinor: -1 }, { amountMinor: 1.5 }, { amountMinor: NaN }, { amountMinor: 2_000_001 },
    { operationReference: "../forged" }, { phoneNumber: "221000000000" },
    { phoneNumber: "+2250000000000" }, { otp: "not-numeric" },
    { returnUrl: "http://example.invalid/" }, { cancelUrl: "https://unapproved.invalid/" },
  ]) await assert.rejects(client.initiate("payin", payment(extra)), hasCode("INVALID_INPUT"));
});

test("mandatory OTP is bounded and forwarded only for payins", async () => {
  const client = new FeexpayClient(live(), async (_url, init) => {
    assert.equal(JSON.parse(init.body).otp, "0".repeat(6));
    return response();
  });
  const input = payment({ channelId: "coris-bj", phoneNumber: `229${"0".repeat(10)}` });
  await assert.rejects(client.initiate("payin", input), hasCode("INVALID_INPUT"));
  await client.initiate("payin", { ...input, otp: "0".repeat(6) });
});

test("timeout, HTTP failures and malformed POST responses are uncertain, sanitized, and never retried", async () => {
  const marker = randomBytes(24).toString("hex");
  for (const makeResponse of [
    () => { throw new Error(marker); },
    () => new Response(marker, { status: 503 }),
    () => new Response(marker),
    () => response({ status: "UNRECOGNIZED" }),
    () => response({ amount: 999 }),
    () => response({ currency: "XAF" }),
  ]) {
    let calls = 0;
    const client = new FeexpayClient(sandbox(), async () => { calls++; return makeResponse(); });
    await assert.rejects(client.initiate("payin", payment()), (error) => {
      assert.equal(error.code, "OUTCOME_UNKNOWN");
      assert.equal(String(error).includes(marker), false);
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("bounded provider body rejects an oversized response", async () => {
  const client = new FeexpayClient(sandbox(), async () => new Response("x".repeat(65 * 1024)));
  await assert.rejects(client.initiate("payin", payment()), hasCode("OUTCOME_UNKNOWN"));
});

test("payin and payout status URLs are separate; references cannot escape the path", async () => {
  for (const [operation, prefix] of [
    ["payin", "/api/transactions/public/single/status/"],
    ["payout", "/api/payouts/status/public/"],
  ]) {
    const client = new FeexpayClient(sandbox(), async (url) => {
      assert.equal(url, `https://sandbox-api.feexpay.me${prefix}${receiptReference}`);
      return response({ status: "IN PENDING STATE" });
    });
    assert.equal((await client.getStatus(operation, receiptReference)).status, "PENDING");
    await assert.rejects(client.getStatus(operation, "../../other"), hasCode("INVALID_INPUT"));
  }
});

test("status rejects a mismatched reference, unknown status or invalid amount and removes personal fields", async () => {
  for (const extra of [
    { reference: randomUUID() }, { status: "PAID" }, { amount: -1 }, { amount: "1e3" }, { currency: "EUR" },
  ]) {
    const client = new FeexpayClient(sandbox(), async () => response(extra));
    await assert.rejects(client.getStatus("payin", receiptReference), hasCode("INVALID_RESPONSE"));
  }
  const client = new FeexpayClient(sandbox(), async () => response({ status: "SUCCESSFUL", phoneNumber: "private", callback_info: "private" }));
  assert.deepEqual(await client.getStatus("payin", receiptReference), { reference: receiptReference, status: "SUCCESSFUL", amountMinor: 1000 });
});
