import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import pg from "pg";
import { randomUUID, createHmac } from "node:crypto";
import { build } from "esbuild";

const { Pool } = pg;
const KEY = "isolated-webhook-test-key-material-32-bytes-minimum";
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = resolve(apiRoot, "../..");
const TEST_ENV_NAMES = [
  "NODE_ENV",
  "SENDFLOW_DATABASE_TARGET",
  "DATABASE_URL",
  "CUSTOMER_PII_ENCRYPTION_KEY",
  "CUSTOMER_PII_ENCRYPTION_KEY_ID",
  "CUSTOMER_PII_ENCRYPTION_KEYRING",
];

function run(binary, args, env) {
  execFileSync(binary, args, { env, stdio: "pipe" });
}

test("isolated webhook outbox-to-worker delivery preserves the public contract", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "sendflow-webhook-integration-"));
  const dataDir = join(temp, "data");
  const socketDir = join(temp, "socket");
  mkdirSync(socketDir, { mode: 0o700 });
  const pgEnv = { PATH: process.env.PATH, HOME: temp, LANG: "C.UTF-8" };
  let server;
  let owner;
  let appPool;
  let postgresStarted = false;
  let runtimePath;
  let mode = { status: 200, delay: 0, retryAfter: undefined };
  const received = [];
  const originalEnv = Object.fromEntries(TEST_ENV_NAMES.map((name) => [name, process.env[name]]));

  try {
    run("initdb", [
      "-D", dataDir,
      "--username=sf_webhook_fixture",
      "--auth=trust",
      "--no-locale",
      "--encoding=UTF8",
    ], pgEnv);
    run("pg_ctl", [
      "-D", dataDir,
      "-l", join(temp, "postgres.log"),
      "-o", `-F -k ${socketDir} -p 15433 -c listen_addresses='' -c max_connections=20`,
      "-w", "start",
    ], pgEnv);
    postgresStarted = true;
    const databaseUrl = `postgresql://sf_webhook_fixture@localhost/postgres?host=${encodeURIComponent(socketDir)}&port=15433`;
    process.env.NODE_ENV = "development";
    process.env.SENDFLOW_DATABASE_TARGET = "development";
    process.env.DATABASE_URL = databaseUrl;
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = KEY;
    process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID = "integration";
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEYRING;

    owner = new Pool({ connectionString: databaseUrl });
    await owner.query(`
      CREATE TABLE sf_developer_payment_sessions (
        id uuid PRIMARY KEY,
        user_id text NOT NULL,
        payment_link_id uuid NOT NULL UNIQUE,
        merchant_reference varchar(128) NOT NULL
      );
      CREATE TABLE sf_developer_webhook_endpoints (
        id uuid PRIMARY KEY,
        user_id text NOT NULL,
        label varchar(80) NOT NULL,
        events text[] NOT NULL,
        status varchar(12) NOT NULL,
        url_encrypted text NOT NULL,
        signing_secret_encrypted text NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE sf_developer_webhook_deliveries (
        id uuid PRIMARY KEY,
        endpoint_id uuid NOT NULL,
        payment_session_id uuid NOT NULL,
        event_type varchar(40) NOT NULL,
        payload jsonb NOT NULL,
        status varchar(12) NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        last_attempt_at timestamptz,
        last_http_status varchar(3),
        last_error_class varchar(40),
        delivered_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(endpoint_id,payment_session_id,event_type),
        CHECK (octet_length(payload::text) <= 16384),
        CHECK (event_type IN ('payment.succeeded','payment.failed')),
        CHECK (status IN ('pending','delivering','delivered','failed')),
        CHECK (attempts BETWEEN 0 AND 100)
      );
    `);

    server = createServer((request, response) => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        received.push({
          body: Buffer.concat(chunks).toString("utf8"),
          headers: request.headers,
          path: request.url,
        });
        if (mode.delay > 0) {
          const timer = setTimeout(() => {
            response.writeHead(mode.status, mode.retryAfter ? { "retry-after": mode.retryAfter } : {});
            response.end();
          }, mode.delay);
          timer.unref();
        } else {
          response.writeHead(mode.status, mode.retryAfter ? { "retry-after": mode.retryAfter } : {});
          response.end();
        }
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    runtimePath = join(apiRoot, ".developer-webhook-test-runtime.mjs");
    await build({
      stdin: {
        contents: `
          export { db, pool } from "@workspace/db";
          export { encryptSensitiveData } from "./src/lib/sensitive-data-crypto.ts";
          export { enqueueDeveloperPaymentEvent } from "./src/services/developer-webhook-outbox.ts";
          export { processNextDeveloperWebhookDelivery } from "./src/services/developer-webhook-worker.ts";
        `,
        resolveDir: apiRoot,
        sourcefile: "developer-webhook-runtime.ts",
        loader: "ts",
      },
      outfile: runtimePath,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node24",
      external: ["pg"],
      alias: {
        "@workspace/db": join(workspaceRoot, "lib/db/src/index.ts"),
      },
    });
    const dbModule = await import(pathToFileURL(runtimePath).href);
    appPool = dbModule.pool;
    const {
      db,
      encryptSensitiveData,
      enqueueDeveloperPaymentEvent,
      processNextDeveloperWebhookDelivery,
    } = dbModule;

    const endpointId = randomUUID();
    const ownerId = "webhook-fixture-owner";
    const signingSecret = "fixture-signing-secret-never-real";
    await owner.query(
      `INSERT INTO sf_developer_webhook_endpoints
        (id,user_id,label,events,status,url_encrypted,signing_secret_encrypted)
       VALUES ($1,$2,'integration fixture',$3,'active',$4,$5)`,
      [
        endpointId,
        ownerId,
        ["payment.succeeded", "payment.failed"],
        encryptSensitiveData("https://merchant.test/hooks/sendflow", "developer-webhook-url"),
        encryptSensitiveData(signingSecret, "developer-webhook-secret"),
      ],
    );

    const fixture = async (eventType = "payment.succeeded", reference = `order-${randomUUID()}`) => {
      const sessionId = randomUUID();
      const paymentLinkId = randomUUID();
      const attemptId = randomUUID();
      const transactionId = randomUUID();
      await owner.query(
        `INSERT INTO sf_developer_payment_sessions
          (id,user_id,payment_link_id,merchant_reference) VALUES ($1,$2,$3,$4)`,
        [sessionId, ownerId, paymentLinkId, reference],
      );
      await db.transaction((tx) => enqueueDeveloperPaymentEvent(tx, {
        paymentLinkId,
        eventType,
        attemptId,
        transactionId,
        amountMinor: 12_500,
        currency: "XOF",
        occurredAt: new Date("2026-11-02T12:00:00.000Z"),
      }));
      const { rows } = await owner.query(
        "SELECT * FROM sf_developer_webhook_deliveries WHERE payment_session_id=$1",
        [sessionId],
      );
      assert.equal(rows.length, 1);
      return { ...rows[0], sessionId, attemptId, transactionId, reference };
    };

    const runtime = {
      resolveTarget: async () => ({
        hostname: "merchant.test",
        address: "127.0.0.1",
        family: 4,
      }),
      request: (options, callback) => {
        const request = httpRequest({
          hostname: "127.0.0.1",
          port,
          path: options.path,
          method: options.method,
          headers: options.headers,
        }, callback);
        return request;
      },
    };

    await t.test("outbox encrypts storage and worker sends canonical signed event", async () => {
      received.length = 0;
      mode = { status: 200, delay: 0, retryAfter: undefined };
      const delivery = await fixture();
      const stored = JSON.stringify(delivery.payload);
      assert.match(stored, /sfenc-v2\.integration\./);
      assert.equal(stored.includes(delivery.reference), false);
      assert.equal(await processNextDeveloperWebhookDelivery(runtime), true);
      const { rows: updatedRows } = await owner.query(
        "SELECT status,attempts,last_error_class FROM sf_developer_webhook_deliveries WHERE id=$1",
        [delivery.id],
      );
      assert.deepEqual(updatedRows[0], {
        status: "delivered",
        attempts: 1,
        last_error_class: null,
      });
      assert.equal(received.length, 1);
      assert.equal(received[0].path, "/hooks/sendflow");
      const body = JSON.parse(received[0].body);
      assert.deepEqual(body, {
        id: delivery.id,
        type: "payment.succeeded",
        createdAt: "2026-11-02T12:00:00.000Z",
        data: {
          sessionId: delivery.sessionId,
          merchantReference: delivery.reference,
          attemptId: delivery.attemptId,
          transactionId: delivery.transactionId,
          amountMinor: 12_500,
          currency: "XOF",
          status: "succeeded",
        },
      });
      const signatureHeader = received[0].headers["sendflow-signature"];
      const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(signatureHeader);
      assert.ok(match);
      const expected = createHmac("sha256", signingSecret)
        .update(`${match[1]}.${received[0].body}`, "utf8")
        .digest("hex");
      assert.equal(match[2], expected);
    });

    await t.test("invalid payload and legacy unknown fields are terminal without network delivery", async () => {
      received.length = 0;
      const corrupt = await fixture();
      const { rows: otherRows } = await owner.query(
        `SELECT payload FROM sf_developer_webhook_deliveries
         WHERE id <> $1 LIMIT 1`,
        [corrupt.id],
      );
      if (otherRows.length) {
        await owner.query(
          "UPDATE sf_developer_webhook_deliveries SET payload=$2 WHERE id=$1",
          [corrupt.id, JSON.stringify(otherRows[0].payload)],
        );
      } else {
        await owner.query(
          "UPDATE sf_developer_webhook_deliveries SET payload=$2 WHERE id=$1",
          [corrupt.id, JSON.stringify({ __sendflow_encrypted_payload: "sfenc-v2.integration.bad" })],
        );
      }
      assert.equal(await processNextDeveloperWebhookDelivery(runtime), true);
      const { rows } = await owner.query(
        "SELECT status,attempts,last_error_class FROM sf_developer_webhook_deliveries WHERE id=$1",
        [corrupt.id],
      );
      assert.deepEqual(rows[0], {
        status: "failed",
        attempts: 1,
        last_error_class: "payload_invalid",
      });
      assert.equal(received.length, 0);

      await owner.query("DELETE FROM sf_developer_webhook_deliveries");
      await owner.query("DELETE FROM sf_developer_payment_sessions");
      const legacy = await fixture();
      const legacyPayload = {
        id: legacy.id,
        type: "payment.succeeded",
        createdAt: "2026-11-02T12:00:00.000Z",
        data: {
          sessionId: legacy.sessionId,
          merchantReference: legacy.reference,
          attemptId: legacy.attemptId,
          transactionId: legacy.transactionId,
          amountMinor: 12_500,
          currency: "XOF",
          status: "succeeded",
          internalSecret: "must-never-be-sent",
        },
      };
      await owner.query(
        "UPDATE sf_developer_webhook_deliveries SET payload=$2 WHERE id=$1",
        [legacy.id, JSON.stringify(legacyPayload)],
      );
      assert.equal(await processNextDeveloperWebhookDelivery(runtime), true);
      const { rows: legacyRows } = await owner.query(
        "SELECT status,last_error_class FROM sf_developer_webhook_deliveries WHERE id=$1",
        [legacy.id],
      );
      assert.deepEqual(legacyRows[0], { status: "failed", last_error_class: "payload_invalid" });
      assert.equal(received.length, 0);
    });

    await t.test("429 and 5xx retain bounded retry behavior and honor Retry-After", async () => {
      for (const status of [429, 503]) {
        await owner.query("DELETE FROM sf_developer_webhook_deliveries");
        await owner.query("DELETE FROM sf_developer_payment_sessions");
        received.length = 0;
        mode = { status, delay: 0, retryAfter: "2" };
        const delivery = await fixture("payment.failed");
        assert.equal(await processNextDeveloperWebhookDelivery(runtime), true);
        const { rows } = await owner.query(
          `SELECT status,attempts,last_error_class,next_attempt_at
           FROM sf_developer_webhook_deliveries WHERE id=$1`,
          [delivery.id],
        );
        assert.equal(rows[0].status, "pending");
        assert.equal(rows[0].attempts, 1);
        assert.equal(rows[0].last_error_class, "http_error");
        assert.ok(new Date(rows[0].next_attempt_at).getTime() > Date.now() + 8_000);
        await owner.query(
          "UPDATE sf_developer_webhook_deliveries SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
          [delivery.id],
        );
        mode = { status: 200, delay: 0, retryAfter: undefined };
        await processNextDeveloperWebhookDelivery(runtime);
        const { rows: retried } = await owner.query(
          "SELECT status,attempts FROM sf_developer_webhook_deliveries WHERE id=$1",
          [delivery.id],
        );
        assert.deepEqual(retried[0], { status: "delivered", attempts: 2 });
      }
    });

    await t.test("concurrent workers claim a delivery once", async () => {
      await owner.query("DELETE FROM sf_developer_webhook_deliveries");
      await owner.query("DELETE FROM sf_developer_payment_sessions");
      received.length = 0;
      mode = { status: 200, delay: 150, retryAfter: undefined };
      const delivery = await fixture();
      const results = await Promise.all([
        processNextDeveloperWebhookDelivery(runtime),
        processNextDeveloperWebhookDelivery(runtime),
      ]);
      assert.equal(results.filter(Boolean).length, 1);
      const { rows } = await owner.query(
        "SELECT status,attempts FROM sf_developer_webhook_deliveries WHERE id=$1",
        [delivery.id],
      );
      assert.deepEqual(rows[0], { status: "delivered", attempts: 1 });
      assert.equal(received.length, 1);
    });

    await t.test("transient failures stop at the configured attempt limit", async () => {
      await owner.query("DELETE FROM sf_developer_webhook_deliveries");
      await owner.query("DELETE FROM sf_developer_payment_sessions");
      received.length = 0;
      mode = { status: 503, delay: 0, retryAfter: undefined };
      const delivery = await fixture();
      for (let attempt = 1; attempt <= 8; attempt += 1) {
        if (attempt > 1) {
          await owner.query(
            "UPDATE sf_developer_webhook_deliveries SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
            [delivery.id],
          );
        }
        await processNextDeveloperWebhookDelivery(runtime);
      }
      const { rows } = await owner.query(
        "SELECT status,attempts,last_error_class FROM sf_developer_webhook_deliveries WHERE id=$1",
        [delivery.id],
      );
      assert.deepEqual(rows[0], {
        status: "failed",
        attempts: 8,
        last_error_class: "http_error",
      });
      assert.equal(received.length, 8);
    });

    await t.test("timeout is recorded as transient and remains pending", async () => {
      await owner.query("DELETE FROM sf_developer_webhook_deliveries");
      await owner.query("DELETE FROM sf_developer_payment_sessions");
      received.length = 0;
      mode = { status: 200, delay: 9_000, retryAfter: undefined };
      const delivery = await fixture();
      await processNextDeveloperWebhookDelivery(runtime);
      const { rows } = await owner.query(
        "SELECT status,attempts,last_error_class FROM sf_developer_webhook_deliveries WHERE id=$1",
        [delivery.id],
      );
      assert.deepEqual(rows[0], {
        status: "pending",
        attempts: 1,
        last_error_class: "timeout",
      });
    });
  } finally {
    await appPool?.end();
    await owner?.end();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (runtimePath) rmSync(runtimePath, { force: true });
    if (postgresStarted) {
      try {
        run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], pgEnv);
      } catch {}
    }
    rmSync(temp, { recursive: true, force: true });
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

