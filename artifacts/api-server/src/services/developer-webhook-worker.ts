import { createHmac } from "node:crypto";
import { request as httpsRequest } from "node:https";
import {
  and,
  db,
  developerWebhookDeliveriesTable,
  developerWebhookEndpointsTable,
  eq,
  gte,
  lte,
  lt,
  or,
  sql,
} from "@workspace/db";
import { decryptSensitiveData } from "../lib/sensitive-data-crypto";
import {
  decryptDeveloperWebhookPayload,
  DeveloperWebhookPayloadError,
} from "../lib/developer-webhook-payload";
import {
  decryptPayoutWebhookPayload,
  PayoutWebhookPayloadError,
} from "../lib/payout-webhook-payload";
import { resolvePublicWebhookTarget } from "./developer-api-security";

const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 10;
const REQUEST_TIMEOUT_MS = 8_000;
const STALE_DELIVERY_MS = 60_000;
const RETRY_DELAYS_MS = [
  10_000,
  30_000,
  2 * 60_000,
  10 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
];
const MAX_RETRY_AFTER_MS = 24 * 60 * 60_000;

type DeliveryResult = { ok: true; status: number } | {
  ok: false;
  status: number | null;
  errorClass: "unsafe_target" | "network_error" | "timeout" | "http_error" | "response_too_large";
  retryAfterMs?: number;
};

type WorkerRuntime = {
  request?: typeof httpsRequest;
  resolveTarget?: typeof resolvePublicWebhookTarget;
};

function parseRetryAfter(value: string | string[] | undefined, now = Date.now()) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const seconds = Number(raw);
  const target = Number.isFinite(seconds) && seconds >= 0
    ? now + seconds * 1000
    : Date.parse(raw);
  if (!Number.isFinite(target)) return undefined;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, target - now));
}

async function postWebhook(
  url: string,
  secret: string,
  payload: Record<string, unknown>,
  runtime: WorkerRuntime = {},
): Promise<DeliveryResult> {
  let parsedUrl: URL;
  let target: Awaited<ReturnType<typeof resolvePublicWebhookTarget>>;
  try {
    parsedUrl = new URL(url);
    target = await (runtime.resolveTarget ?? resolvePublicWebhookTarget)(url);
  } catch {
    return { ok: false, status: null, errorClass: "unsafe_target" };
  }
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: DeliveryResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const request = (runtime.request ?? httpsRequest)({
      protocol: "https:",
      hostname: target.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 443,
      servername: target.hostname,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: "POST",
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(body, "utf8")),
        "user-agent": "SendFlow-Webhooks/1.0",
        "sendflow-event": String(payload.type ?? ""),
        "sendflow-delivery": String(payload.id ?? ""),
        "sendflow-signature": `t=${timestamp},v1=${signature}`,
      },
    }, (response) => {
      let responseBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        responseBytes += Buffer.byteLength(chunk);
        if (responseBytes > 8_192) {
          response.destroy();
          finish({ ok: false, status: response.statusCode ?? null, errorClass: "response_too_large" });
        }
      });
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        finish(status >= 200 && status < 300
          ? { ok: true, status }
          : {
            ok: false,
            status,
            errorClass: "http_error",
            retryAfterMs: parseRetryAfter(response.headers["retry-after"]),
          });
      });
      response.on("error", () => finish({
        ok: false,
        status: response.statusCode ?? null,
        errorClass: "network_error",
      }));
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy();
      finish({ ok: false, status: null, errorClass: "timeout" });
    });
    request.on("error", () => finish({ ok: false, status: null, errorClass: "network_error" }));
    request.end(body);
  });
}

async function claimNextDelivery() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_DELIVERY_MS);
  return db.transaction(async (tx) => {
    await tx.update(developerWebhookDeliveriesTable).set({
      status: "failed",
      lastErrorClass: "retry_limit_reached",
      updatedAt: now,
    }).where(or(
      and(
        eq(developerWebhookDeliveriesTable.status, "pending"),
        gte(developerWebhookDeliveriesTable.attempts, MAX_ATTEMPTS),
      ),
      and(
        eq(developerWebhookDeliveriesTable.status, "delivering"),
        lte(developerWebhookDeliveriesTable.lastAttemptAt, staleBefore),
        gte(developerWebhookDeliveriesTable.attempts, MAX_ATTEMPTS),
      ),
    ));
    const [candidate] = await tx.select()
      .from(developerWebhookDeliveriesTable)
      .where(or(
        and(
          eq(developerWebhookDeliveriesTable.status, "pending"),
          lte(developerWebhookDeliveriesTable.nextAttemptAt, now),
          lt(developerWebhookDeliveriesTable.attempts, MAX_ATTEMPTS),
        ),
        and(
          eq(developerWebhookDeliveriesTable.status, "delivering"),
          lte(developerWebhookDeliveriesTable.lastAttemptAt, staleBefore),
          lt(developerWebhookDeliveriesTable.attempts, MAX_ATTEMPTS),
        ),
      ))
      .orderBy(developerWebhookDeliveriesTable.nextAttemptAt, developerWebhookDeliveriesTable.createdAt)
      .for("update", { skipLocked: true })
      .limit(1);
    if (!candidate) return null;
    const [claimed] = await tx.update(developerWebhookDeliveriesTable).set({
      status: "delivering",
      attempts: sql`${developerWebhookDeliveriesTable.attempts} + 1`,
      lastAttemptAt: now,
      updatedAt: now,
    }).where(eq(developerWebhookDeliveriesTable.id, candidate.id))
      .returning();
    return claimed ?? null;
  });
}

export async function processNextDeveloperWebhookDelivery(runtime: WorkerRuntime = {}) {
  const delivery = await claimNextDelivery();
  if (!delivery) return false;
  const [endpoint] = await db.select().from(developerWebhookEndpointsTable)
    .where(eq(developerWebhookEndpointsTable.id, delivery.endpointId))
    .limit(1);
  if (!endpoint || endpoint.status !== "active") {
    await db.update(developerWebhookDeliveriesTable).set({
      status: "failed",
      lastErrorClass: "endpoint_revoked",
      updatedAt: new Date(),
    }).where(and(
      eq(developerWebhookDeliveriesTable.id, delivery.id),
      eq(developerWebhookDeliveriesTable.status, "delivering"),
    ));
    return true;
  }

  let result: DeliveryResult;
  try {
    const url = decryptSensitiveData(endpoint.urlEncrypted, "developer-webhook-url");
    const signingSecret = decryptSensitiveData(endpoint.signingSecretEncrypted, "developer-webhook-secret");
    const payload = delivery.eventType.startsWith("payout.")
      ? decryptPayoutWebhookPayload(delivery.payload, {
        deliveryId: delivery.id,
        eventType: delivery.eventType as
          | "payout.created" | "payout.processing" | "payout.succeeded" | "payout.failed" | "payout.uncertain",
      })
      : decryptDeveloperWebhookPayload(delivery.payload, {
        deliveryId: delivery.id,
        eventType: delivery.eventType as "payment.succeeded" | "payment.failed",
      });
    result = await postWebhook(url, signingSecret, payload, runtime);
  } catch (error) {
    if (error instanceof DeveloperWebhookPayloadError || error instanceof PayoutWebhookPayloadError) {
      await db.update(developerWebhookDeliveriesTable).set({
        status: "failed",
        lastHttpStatus: null,
        lastErrorClass: "payload_invalid",
        updatedAt: new Date(),
      }).where(and(
        eq(developerWebhookDeliveriesTable.id, delivery.id),
        eq(developerWebhookDeliveriesTable.status, "delivering"),
      ));
      return true;
    }
    result = { ok: false, status: null, errorClass: "unsafe_target" };
  }

  const now = new Date();
  if (result.ok) {
    await db.update(developerWebhookDeliveriesTable).set({
      status: "delivered",
      lastHttpStatus: String(result.status),
      lastErrorClass: null,
      deliveredAt: now,
      updatedAt: now,
    }).where(and(
      eq(developerWebhookDeliveriesTable.id, delivery.id),
      eq(developerWebhookDeliveriesTable.status, "delivering"),
    ));
    return true;
  }

  const isFinal = delivery.attempts >= MAX_ATTEMPTS;
  const backoff = RETRY_DELAYS_MS[Math.min(delivery.attempts - 1, RETRY_DELAYS_MS.length - 1)]!;
  const delay = Math.max(backoff, result.retryAfterMs ?? 0);
  await db.update(developerWebhookDeliveriesTable).set({
    status: isFinal ? "failed" : "pending",
    lastHttpStatus: result.status === null ? null : String(result.status),
    lastErrorClass: result.errorClass,
    nextAttemptAt: new Date(now.getTime() + delay),
    updatedAt: now,
  }).where(and(
    eq(developerWebhookDeliveriesTable.id, delivery.id),
    eq(developerWebhookDeliveriesTable.status, "delivering"),
  ));
  return true;
}

export function startDeveloperWebhookWorker(logger: {
  error: (context: Record<string, unknown>, message: string) => void;
  info?: (context: Record<string, unknown>, message: string) => void;
}) {
  let active = false;
  const interval = setInterval(async () => {
    if (active) return;
    active = true;
    try {
      for (let index = 0; index < BATCH_SIZE; index += 1) {
        if (!await processNextDeveloperWebhookDelivery()) break;
      }
    } catch {
      logger.error({ component: "developer-webhook-worker" }, "Webhook worker batch failed");
    } finally {
      active = false;
    }
  }, 5_000);
  interval.unref();
  logger.info?.({ component: "developer-webhook-worker" }, "Webhook worker started");
  return () => clearInterval(interval);
}
