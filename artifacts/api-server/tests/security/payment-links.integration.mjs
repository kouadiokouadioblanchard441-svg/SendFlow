import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import http from "node:http";
import pg from "pg";
import sharp from "sharp";
import {
  isPaymentLinkCreationAllowed,
  isPaymentLinkSimulationAllowed,
  normalizePaymentLinkImage,
  normalizePaymentLinkInput,
  PAYMENT_LINK_IMAGE_MAX_BYTES,
} from "../../src/services/payment-links.ts";
import { toPreviewPasswordHash } from "../../src/lib/preview-credential-policy.ts";
import {
  isViewerRouteCandidate,
  shouldBlockSharedNeonApiRequest,
} from "../../src/lib/shared-neon-preview-guard.ts";

if (!process.env.SENDFLOW_ISOLATED_RUNTIME?.includes("/sendflow-isolated-finance-")
  || !process.env.SENDFLOW_FIXTURE_SOCKET?.includes("/sendflow-isolated-finance-")) {
  throw new Error("Run only through the isolated PostgreSQL runner");
}

globalThis.fetch = async () => { throw new Error("External network forbidden in payment-link tests"); };
const runtime = createRequire(import.meta.url)(process.env.SENDFLOW_ISOLATED_RUNTIME);
const owner = new pg.Pool({
  host: process.env.SENDFLOW_FIXTURE_SOCKET,
  port: 15432,
  database: "postgres",
  user: "sf_fixture_owner",
});
const tokens = new Map();
let server;

before(async () => {
  for (const [userId, unlocked] of [
    ["payment-link-owner-a", true],
    ["payment-link-owner-b", true],
    ["payment-link-image-owner", true],
    ["payment-link-locked", false],
    ["payment-link-concurrent", true],
    ["payment-link-rate", true],
    ["payment-link-detail", true],
  ]) {
    await owner.query("INSERT INTO sf_users(id,status,display_name) VALUES($1,'active',$2)", [userId, userId]);
    await owner.query(`INSERT INTO sf_customer_credentials
      (user_id,password_hash,pin_hash,privacy_accepted_at,privacy_policy_version)
      VALUES($1,'fixture-unused-hash','fixture-unused-pin',now(),'fixture')`, [userId]);
    const token = randomBytes(32).toString("base64url");
    tokens.set(userId, token);
    await owner.query(`INSERT INTO sf_customer_sessions(user_id,token_hash,expires_at,pin_verified_until)
      VALUES($1,$2,now()+interval '1 hour',$3)`,
    [userId, runtime.hashCustomerSessionToken(token), unlocked ? new Date(Date.now() + 15 * 60_000) : null]);
  }
  const viewerId = "payment-link-viewer";
  const viewerToken = randomBytes(32).toString("base64url");
  tokens.set(viewerId, viewerToken);
  await owner.query("INSERT INTO sf_users(id,status,display_name) VALUES($1,'active',$2)", [viewerId, viewerId]);
  await owner.query(`INSERT INTO sf_customer_credentials
    (user_id,password_hash,pin_hash,privacy_accepted_at,privacy_policy_version)
    VALUES($1,$2,NULL,now(),'internal-preview-authorization-v1')`,
  [viewerId, toPreviewPasswordHash("scrypt$v1$isolated-preview-fixture")]);
  await owner.query("INSERT INTO sf_wallets(user_id,balance_minor) VALUES($1,0)", [viewerId]);
  await owner.query(`INSERT INTO sf_preview_access(slot,user_id,expires_at,created_at)
    VALUES(1,$1,now()+interval '1 hour',now())`, [viewerId]);
  await owner.query(`INSERT INTO sf_customer_sessions(user_id,token_hash,expires_at,pin_verified_until)
    VALUES($1,$2,now()+interval '1 hour',NULL)`,
  [viewerId, runtime.hashCustomerSessionToken(viewerToken, { SENDFLOW_DATABASE_TARGET: "shared-neon" })]);
  server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
});

// The isolated database is shared by tests in this file. Reset its customer
// quota buckets between tests while keeping rate limiting active within each test.
beforeEach(async () => {
  await owner.query("TRUNCATE sf_api_request_limits");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await runtime.pool.end();
  await owner.end();
});

function rawRequest(path, { method = "GET", userId, body, headers = {} } = {}) {
  const data = body === undefined
    ? undefined
    : Buffer.isBuffer(body) ? body : JSON.stringify(body);
  const cookie = userId ? `__Host-sendflow_session=${tokens.get(userId)}` : undefined;
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: {
        Origin: "https://sendflow-test.invalid",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data === undefined ? {} : {
          "Content-Type": Buffer.isBuffer(body) ? "application/octet-stream" : "application/json",
          "Content-Length": Buffer.byteLength(data),
        }),
        ...headers,
      },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text, headers: res.headers }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

async function request(path, { method = "GET", userId, body, origin, csrf = true, headers = {} } = {}) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return rawRequest(path, {
      method,
      userId,
      headers: origin === undefined ? {} : { Origin: origin },
    });
  }
  if (!csrf) {
    return rawRequest(path, {
      method,
      userId,
      body,
      headers: { ...headers, ...(origin === undefined ? {} : { Origin: origin }) },
    });
  }
  const bootstrap = await rawRequest("/api/auth/session", {
    method: "GET",
    userId,
    headers: origin === undefined ? {} : { Origin: origin },
  });
  const token = bootstrap.headers["x-csrf-token"];
  assert.equal(typeof token, "string", "isolated session bootstrap should issue a CSRF token");
  const csrfCookie = bootstrap.headers["set-cookie"]
    ?.find((value) => value.startsWith("__Host-sendflow_csrf="))
    ?.split(";")[0];
  const cookie = [
    userId ? `__Host-sendflow_session=${tokens.get(userId)}` : null,
    csrfCookie,
  ].filter(Boolean).join("; ");
  return rawRequest(path, {
    method,
    body,
    headers: {
      ...(origin === undefined ? {} : { Origin: origin }),
      Cookie: cookie,
      "X-CSRF-Token": token,
      ...headers,
    },
  });
}

function validInput(overrides = {}) {
  return {
    requestId: randomUUID(),
    currency: "XOF",
    amount: "1250",
    linkName: "Flow digital SARL",
    description: "Facture SendFlow",
    paymentMethod: "all",
    validity: "day",
    maximumUses: null,
    returnUrl: null,
    suffix: null,
    ...overrides,
  };
}

function json(response) {
  return JSON.parse(response.text);
}

test("payment-link amount rules and shared-Neon preview scope fail closed", () => {
  assert.equal(normalizePaymentLinkInput(validInput({
    linkName: "  Flow digital SARL  ",
  })).linkName, "Flow digital SARL");
  assert.throws(() => normalizePaymentLinkInput(validInput({ linkName: " " })));
  assert.throws(() => normalizePaymentLinkInput(validInput({ linkName: "x".repeat(121) })));
  assert.equal(normalizePaymentLinkInput(validInput({
    currency: "USD",
    amount: "10.25",
  })).amountMinor, 1025);
  const payerPriced = normalizePaymentLinkInput(validInput({
    amount: "",
    description: "",
  }));
  assert.equal(payerPriced.amountMinor, 0);
  assert.equal(payerPriced.description, "");
  assert.throws(() => normalizePaymentLinkInput(validInput({
    currency: "XAF",
    amount: "0",
  })));
  assert.equal(isPaymentLinkCreationAllowed(
    { paymentTestAccount: false },
    { SENDFLOW_DATABASE_TARGET: "shared-neon" },
  ), true);
  assert.equal(isPaymentLinkCreationAllowed(
    { paymentTestAccount: true },
    { SENDFLOW_DATABASE_TARGET: "shared-neon" },
  ), false);
  assert.equal(isPaymentLinkSimulationAllowed(
    { previewAccount: true, paymentTestAccount: false },
    { SENDFLOW_DATABASE_TARGET: "shared-neon", FEEXPAY_EXECUTION_HOST: "replit" },
  ), true);
  assert.equal(isPaymentLinkSimulationAllowed(
    { previewAccount: true, paymentTestAccount: false },
    { SENDFLOW_DATABASE_TARGET: "production", FEEXPAY_EXECUTION_HOST: "plesk" },
  ), false);
  assert.equal(isPaymentLinkSimulationAllowed(
    { previewAccount: false, paymentTestAccount: false },
    { SENDFLOW_DATABASE_TARGET: "shared-neon", FEEXPAY_EXECUTION_HOST: "replit" },
  ), false);
  assert.equal(isPaymentLinkSimulationAllowed(
    { previewAccount: true, paymentTestAccount: true },
    { SENDFLOW_DATABASE_TARGET: "shared-neon", FEEXPAY_EXECUTION_HOST: "replit" },
  ), false);
  assert.equal(isPaymentLinkCreationAllowed(
    { paymentTestAccount: true },
    { SENDFLOW_DATABASE_TARGET: "development" },
  ), true);
  assert.equal(isViewerRouteCandidate("GET", "/api/me/payment-links"), true);
  assert.equal(isViewerRouteCandidate("POST", "/api/me/payment-links"), true);
  const linkId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(isViewerRouteCandidate("GET", `/api/me/payment-links/${linkId}`), true);
  assert.equal(isViewerRouteCandidate("PATCH", `/api/me/payment-links/${linkId}`), true);
  assert.equal(isViewerRouteCandidate("DELETE", `/api/me/payment-links/${linkId}`), true);
  assert.equal(isViewerRouteCandidate(
    "POST",
    "/api/me/payment-links/simulate/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  ), true);
  assert.equal(isViewerRouteCandidate("DELETE", "/api/me/payment-links"), false);
  assert.equal(isViewerRouteCandidate("GET", "/api/me/payment-links/foreign"), false);
  assert.equal(isViewerRouteCandidate(
    "POST",
    "/api/me/payment-links/123e4567-e89b-42d3-a456-426614174000/image",
  ), true);
  assert.equal(isViewerRouteCandidate(
    "POST",
    "/api/me/payment-links/123e4567-e89b-42d3-a456-426614174000/image/extra",
  ), false);
  assert.equal(shouldBlockSharedNeonApiRequest(
    "GET",
    "/api/public/payment-links/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    { SENDFLOW_DATABASE_TARGET: "shared-neon" },
  ), false);
});

test("payment-link schema migration is present and operates only in the isolated fixture", async () => {
  const result = await owner.query(`SELECT count(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='sf_customer_payment_links'`);
  assert.equal(result.rows[0].count, 1);
  const columns = await owner.query(`SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sf_customer_payment_links'
    ORDER BY ordinal_position`);
  assert.deepEqual(columns.rows, [
    { column_name: "id", data_type: "uuid", character_maximum_length: null, is_nullable: "NO" },
    { column_name: "user_id", data_type: "text", character_maximum_length: null, is_nullable: "NO" },
    { column_name: "public_token", data_type: "character varying", character_maximum_length: 43, is_nullable: "NO" },
    { column_name: "idempotency_key", data_type: "uuid", character_maximum_length: null, is_nullable: "NO" },
    { column_name: "request_hash", data_type: "character varying", character_maximum_length: 64, is_nullable: "NO" },
    { column_name: "currency", data_type: "character varying", character_maximum_length: 3, is_nullable: "NO" },
    { column_name: "amount_minor", data_type: "bigint", character_maximum_length: null, is_nullable: "NO" },
    { column_name: "description", data_type: "character varying", character_maximum_length: 240, is_nullable: "NO" },
    { column_name: "payment_method", data_type: "character varying", character_maximum_length: 20, is_nullable: "NO" },
    { column_name: "expires_at", data_type: "timestamp with time zone", character_maximum_length: null, is_nullable: "YES" },
    { column_name: "maximum_uses", data_type: "integer", character_maximum_length: null, is_nullable: "YES" },
    { column_name: "usage_count", data_type: "integer", character_maximum_length: null, is_nullable: "NO" },
    { column_name: "return_url", data_type: "character varying", character_maximum_length: 2048, is_nullable: "YES" },
    { column_name: "custom_suffix", data_type: "character varying", character_maximum_length: 32, is_nullable: "YES" },
    { column_name: "status", data_type: "character varying", character_maximum_length: 24, is_nullable: "NO" },
    { column_name: "image_data", data_type: "bytea", character_maximum_length: null, is_nullable: "YES" },
    { column_name: "image_size_bytes", data_type: "integer", character_maximum_length: null, is_nullable: "YES" },
    { column_name: "created_at", data_type: "timestamp with time zone", character_maximum_length: null, is_nullable: "NO" },
    { column_name: "updated_at", data_type: "timestamp with time zone", character_maximum_length: null, is_nullable: "NO" },
    { column_name: "link_name", data_type: "character varying", character_maximum_length: 120, is_nullable: "YES" },
    { column_name: "deleted_at", data_type: "timestamp with time zone", character_maximum_length: null, is_nullable: "YES" },
  ]);
  const constraints = await owner.query(`SELECT conname FROM pg_constraint
    WHERE conrelid='public.sf_customer_payment_links'::regclass
      AND contype <> 'n' ORDER BY conname`);
  assert.deepEqual(constraints.rows.map((row) => row.conname).sort(), [
    "sf_customer_payment_links_amount_check",
    "sf_customer_payment_links_currency_check",
    "sf_customer_payment_links_description_check",
    "sf_customer_payment_links_image_data_check",
    "sf_customer_payment_links_link_name_check",
    "sf_customer_payment_links_maximum_uses_check",
    "sf_customer_payment_links_payment_method_check",
    "sf_customer_payment_links_pkey",
    "sf_customer_payment_links_request_hash_check",
    "sf_customer_payment_links_return_url_check",
    "sf_customer_payment_links_status_check",
    "sf_customer_payment_links_suffix_check",
    "sf_customer_payment_links_token_check",
    "sf_customer_payment_links_usage_count_check",
    "sf_customer_payment_links_user_id_fkey",
  ]);
  const validatedAmountRules = await owner.query(`SELECT conname, convalidated
    FROM pg_constraint
    WHERE conrelid='public.sf_customer_payment_links'::regclass
      AND conname IN ('sf_customer_payment_links_amount_check','sf_customer_payment_links_description_check')
    ORDER BY conname`);
  assert.deepEqual(validatedAmountRules.rows, [
    { conname: "sf_customer_payment_links_amount_check", convalidated: true },
    { conname: "sf_customer_payment_links_description_check", convalidated: true },
  ]);
  const indexes = await owner.query(`SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='sf_customer_payment_links' ORDER BY indexname`);
  assert.deepEqual(indexes.rows.map((row) => row.indexname).sort(), [
    "sf_customer_payment_links_owner_created_idx",
    "sf_customer_payment_links_owner_idempotency_uq",
    "sf_customer_payment_links_pkey",
    "sf_customer_payment_links_public_token_uq",
  ]);
});

test("image upload validates bytes, strips source format and stays owner-scoped", async () => {
  const createdResponse = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-image-owner",
    body: validInput(),
  });
  assert.equal(createdResponse.status, 201);
  const linkId = json(createdResponse).id;
  const source = await sharp({
    create: { width: 4, height: 3, channels: 4, background: { r: 84, g: 43, b: 150, alpha: 1 } },
  }).png().toBuffer();

  const savedResponse = await request(`/api/me/payment-links/${linkId}/image`, {
    method: "POST",
    userId: "payment-link-image-owner",
    body: source,
    headers: { "Content-Type": "image/png" },
  });
  assert.equal(savedResponse.status, 204);

  const saved = await owner.query(
    "SELECT image_data, image_size_bytes FROM sf_customer_payment_links WHERE id=$1",
    [linkId],
  );
  assert.equal(saved.rows[0].image_size_bytes, saved.rows[0].image_data.length);
  assert.ok(saved.rows[0].image_size_bytes <= PAYMENT_LINK_IMAGE_MAX_BYTES);
  const metadata = await sharp(saved.rows[0].image_data).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok(!metadata.pages || metadata.pages === 1);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  const publicImage = await request(
    `/api/public/payment-links/${json(createdResponse).sharePath.split("/").at(-1)}/image`,
  );
  assert.equal(publicImage.status, 200, publicImage.text);
  assert.match(publicImage.headers["content-type"], /^image\/webp/);
  await assert.rejects(
    owner.query(
      "UPDATE sf_customer_payment_links SET image_size_bytes=image_size_bytes+1 WHERE id=$1",
      [linkId],
    ),
    (error) => error.code === "23514",
  );

  const foreignOwnerResponse = await request(`/api/me/payment-links/${linkId}/image`, {
    method: "POST",
    userId: "payment-link-owner-b",
    body: source,
    headers: { "Content-Type": "image/png" },
  });
  assert.equal(foreignOwnerResponse.status, 404);

  const invalidImage = await request(`/api/me/payment-links/${linkId}/image`, {
    method: "POST",
    userId: "payment-link-image-owner",
    body: Buffer.from("<script>not-an-image</script>"),
    headers: { "Content-Type": "image/png" },
  });
  assert.equal(invalidImage.status, 400);

  const withoutCsrf = await request(`/api/me/payment-links/${linkId}/image`, {
    method: "POST",
    userId: "payment-link-image-owner",
    body: source,
    csrf: false,
    headers: { "Content-Type": "image/png" },
  });
  assert.equal(withoutCsrf.status, 403);
  const oversizedUpload = await request(`/api/me/payment-links/${linkId}/image`, {
    method: "POST",
    userId: "payment-link-image-owner",
    body: Buffer.alloc(PAYMENT_LINK_IMAGE_MAX_BYTES + 1),
    headers: { "Content-Type": "image/png" },
  });
  assert.equal(oversizedUpload.status, 413);
  const list = await request("/api/me/payment-links", { userId: "payment-link-image-owner" });
  assert.equal(list.status, 200);
  assert.equal(Object.hasOwn(json(list).items[0], "imageData"), false);
  const rowAfterRejectedUploads = await owner.query(
    "SELECT image_data FROM sf_customer_payment_links WHERE id=$1",
    [linkId],
  );
  assert.deepEqual(rowAfterRejectedUploads.rows[0].image_data, saved.rows[0].image_data);
});

test("payment-link image rejects MIME spoofing, malformed and oversized files", async () => {
  const unsupported = await normalizePaymentLinkImage(
    Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
    "image/svg+xml",
  ).catch((error) => error);
  assert.equal(unsupported.status, 415);
  const mismatched = await normalizePaymentLinkImage(
    Buffer.from("<html>active content</html>"),
    "image/png",
  ).catch((error) => error);
  assert.equal(mismatched.status, 400);
  const oversized = await normalizePaymentLinkImage(
    Buffer.alloc(PAYMENT_LINK_IMAGE_MAX_BYTES + 1),
    "image/png",
  ).catch((error) => error);
  assert.equal(oversized.status, 413);
});

test("payment links require a verified PIN, CSRF and an authorized origin", async () => {
  const beforeCount = Number((await owner.query(
    "SELECT count(*)::int AS count FROM sf_customer_payment_links",
  )).rows[0].count);
  const locked = await request("/api/me/payment-links", { userId: "payment-link-locked" });
  assert.equal(locked.status, 403);
  const noSession = await request("/api/me/payment-links", {
    method: "POST",
    body: validInput(),
  });
  assert.equal(noSession.status, 401);
  const missingCsrf = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-owner-a",
    body: validInput(),
    csrf: false,
  });
  assert.equal(missingCsrf.status, 403);
  const foreignOrigin = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-owner-a",
    body: validInput(),
    origin: "https://attacker.invalid",
    csrf: false,
  });
  assert.equal(foreignOrigin.status, 403);
  const afterCount = Number((await owner.query(
    "SELECT count(*)::int AS count FROM sf_customer_payment_links",
  )).rows[0].count);
  assert.equal(afterCount, beforeCount);
});

test("create validates currency precision and minimum amount before persisting", async () => {
  for (const body of [
    validInput({ amount: "9" }),
    validInput({ currency: "XOF", amount: "10.01" }),
    validInput({ currency: "USD", amount: "10.001" }),
    ...["CHF", "NGN", "EUR", "CAD"].map((currency) => validInput({ currency, amount: "10" })),
    validInput({ returnUrl: "http://example.invalid/return" }),
    validInput({ suffix: "Not A Safe Suffix" }),
  ]) {
    const response = await request("/api/me/payment-links", {
      method: "POST",
      userId: "payment-link-owner-a",
      body,
    });
    assert.equal(response.status, 400, response.text);
  }
  assert.equal(Number((await owner.query(
    "SELECT count(*)::int AS count FROM sf_customer_payment_links WHERE user_id='payment-link-owner-a'",
  )).rows[0].count), 0);
});

test("create uses server-owned values, is idempotent and rejects changed replays", async () => {
  const body = validInput({ amount: "1250", description: "  Facture client  " });
  const first = await request("/api/me/payment-links", {
    method: "POST", userId: "payment-link-owner-a", body,
  });
  assert.equal(first.status, 201, first.text);
  const firstLink = json(first);
  assert.equal(firstLink.currency, "XOF");
  assert.equal(firstLink.currencyDecimals, 0);
  assert.equal(firstLink.amountMinor, 1250);
  assert.equal(firstLink.description, "Facture client");
  assert.equal(firstLink.status, "active");
  assert.match(firstLink.sharePath, /^\/pay\/[A-Za-z0-9_-]{43}$/);
  assert.equal(firstLink.usageCount, 0);
  assert.equal(firstLink.maximumUses, null);
  assert.equal(typeof firstLink.expiresAt, "string");
  assert.match(firstLink.code, /^[A-Za-z0-9_-]{8}$/);

  const replay = await request("/api/me/payment-links", {
    method: "POST", userId: "payment-link-owner-a", body,
  });
  assert.equal(replay.status, 201, replay.text);
  assert.equal(json(replay).id, firstLink.id);
  assert.equal(json(replay).sharePath, firstLink.sharePath);

  const conflict = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-owner-a",
    body: { ...body, linkName: "Autre marchand" },
  });
  assert.equal(conflict.status, 409);
  assert.equal(Number((await owner.query(
    "SELECT count(*)::int AS count FROM sf_customer_payment_links WHERE user_id='payment-link-owner-a'",
  )).rows[0].count), 1);
});

test("payer-priced LinkFlow can be created without amount or description and quotes the entered amount", async () => {
  await owner.query(`INSERT INTO sf_countries
    (country_code,country_name,phone_prefix,min_phone_digits,max_phone_digits,
      enabled,deposit_enabled,inter_network_enabled,international_enabled,created_by,updated_by)
    VALUES ('ci','Côte d’Ivoire','+225',8,10,true,true,false,false,'fixture','fixture')
    ON CONFLICT (country_code) DO UPDATE SET enabled=true,deposit_enabled=true`);
  await owner.query(`INSERT INTO sf_operator_catalog
    (operator_id,country_code,name,short_name,initials,brand,enabled,deposit_enabled,
      inter_network_enabled,international_enabled,created_by,updated_by)
    VALUES ('mtn-ci','ci','MTN','MTN','MTN','mtn',true,true,false,false,'fixture','fixture')
    ON CONFLICT (operator_id) DO UPDATE SET enabled=true,deposit_enabled=true`);
  await owner.query(`DELETE FROM sf_operator_pricing_rates
    WHERE operator_id='mtn-ci' AND category_id IN ('deposit','linkflow')`);
  await owner.query(`INSERT INTO sf_operator_pricing_rates
    (operator_id,country_code,category_id,fee_percent,version,created_by,updated_by)
    VALUES ('mtn-ci','ci','linkflow',2,1,'fixture','fixture')`);
  await owner.query(`INSERT INTO sf_payment_aggregators(code,name,enabled,created_by,updated_by)
    VALUES ('feexpay','FeexPay',true,'fixture','fixture')
    ON CONFLICT (code) DO UPDATE SET enabled=true`);
  await owner.query(`DELETE FROM sf_operation_aggregator_routes
    WHERE scope_type IN ('country','operator') AND scope_key IN ('ci','ci:mtn-ci')
      AND operation='deposit'`);
  await owner.query(`INSERT INTO sf_operation_aggregator_routes
    (scope_type,scope_key,country_code,operation,aggregator_code,version,created_by,updated_by)
    VALUES ('country','ci','ci','deposit','feexpay',1,'fixture','fixture')`);
  const body = validInput();
  delete body.amount;
  delete body.description;
  const created = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-owner-a",
    body,
  });
  assert.equal(created.status, 201, created.text);
  const link = json(created);
  assert.equal(link.amountMinor, 0);
  assert.equal(link.description, "");

  const token = link.sharePath.split("/").at(-1);
  const page = await request(`/api/public/payment-links/${token}`);
  assert.equal(page.status, 200, page.text);
  assert.equal(json(page).amountMinor, 0);
  assert.equal(json(page).description, "");

  const missingAmount = await request(`/api/public/payment-links/${token}/quote/ci/mtn-ci`);
  assert.equal(missingAmount.status, 400);
  const quote = await request(`/api/public/payment-links/${token}/quote/ci/mtn-ci`, {
    method: "POST",
    body: { amount: "500" },
  });
  assert.equal(quote.status, 200, quote.text);
  assert.deepEqual(json(quote), {
    currency: "XOF",
    amountMinor: 500,
    totalMinor: 500,
    operatorId: "mtn-ci",
  });
  const belowProviderMinimum = await request(`/api/public/payment-links/${token}/quote/ci/mtn-ci`, {
    method: "POST",
    body: { amount: "99" },
  });
  assert.equal(belowProviderMinimum.status, 400);

  const saved = await owner.query(
    "SELECT amount_minor, description FROM sf_customer_payment_links WHERE id=$1",
    [link.id],
  );
  assert.deepEqual(saved.rows[0], { amount_minor: "0", description: "" });

  const setFixedAmount = await request(`/api/me/payment-links/${link.id}`, {
    method: "PATCH",
    userId: "payment-link-owner-a",
    body: { amount: "1500" },
  });
  assert.equal(setFixedAmount.status, 200, setFixedAmount.text);
  assert.equal(json(setFixedAmount).amountMinor, 1500);
  assert.equal(json(setFixedAmount).description, "");
  const restoreVariableAmount = await request(`/api/me/payment-links/${link.id}`, {
    method: "PATCH",
    userId: "payment-link-owner-a",
    body: { amount: "0" },
  });
  assert.equal(restoreVariableAmount.status, 200, restoreVariableAmount.text);
  assert.equal(json(restoreVariableAmount).amountMinor, 0);
  await owner.query("DELETE FROM sf_customer_payment_links WHERE id=$1", [link.id]);
});

test("public payment page is token-scoped and quotes the fee from server pricing", async () => {
  await owner.query(`INSERT INTO sf_countries
    (country_code,country_name,phone_prefix,min_phone_digits,max_phone_digits,
      enabled,deposit_enabled,inter_network_enabled,international_enabled,created_by,updated_by)
    VALUES ('ci','Côte d’Ivoire','+225',8,10,true,true,false,false,'fixture','fixture')
    ON CONFLICT (country_code) DO UPDATE SET enabled=true,deposit_enabled=true`);
  await owner.query(`INSERT INTO sf_operator_catalog
    (operator_id,country_code,name,short_name,initials,brand,enabled,deposit_enabled,
      inter_network_enabled,international_enabled,created_by,updated_by)
    VALUES ('mtn-ci','ci','MTN','MTN','MTN','mtn',true,true,false,false,'fixture','fixture')
    ON CONFLICT (operator_id) DO UPDATE SET enabled=true,deposit_enabled=true`);
  await owner.query("DELETE FROM sf_operator_pricing_rates WHERE operator_id='mtn-ci' AND category_id IN ('deposit','linkflow')");
  await owner.query(`INSERT INTO sf_operator_pricing_rates
    (operator_id,country_code,category_id,fee_percent,version,created_by,updated_by)
    VALUES ('mtn-ci','ci','linkflow',2,1,'fixture','fixture')`);
  await owner.query(`INSERT INTO sf_payment_aggregators(code,name,enabled,created_by,updated_by)
    VALUES ('feexpay','FeexPay',true,'fixture','fixture')
    ON CONFLICT (code) DO UPDATE SET enabled=true`);
  await owner.query(`DELETE FROM sf_operation_aggregator_routes
    WHERE scope_type IN ('country','operator') AND scope_key IN ('ci','ci:mtn-ci')
      AND operation='deposit'`);
  await owner.query(`INSERT INTO sf_operation_aggregator_routes
    (scope_type,scope_key,country_code,operation,aggregator_code,version,created_by,updated_by)
    VALUES ('country','ci','ci','deposit','feexpay',1,'fixture','fixture')`);

  const created = await request("/api/me/payment-links", {
      method: "POST",
      userId: "payment-link-owner-a",
      body: validInput({ amount: "1250", description: "Facture test public" }),
  });
  assert.equal(created.status, 201, created.text);
  const link = json(created);
  const token = link.sharePath.split("/").at(-1);
  const page = await request(`/api/public/payment-links/${token}`);
  assert.equal(page.status, 200, page.text);
  const details = json(page);
  assert.equal(details.merchantName, "Flow digital SARL");
  assert.equal(details.state, "active");
  assert.equal(details.amountMinor, 1250);
  assert.equal(details.paymentAvailable, false);
  assert.equal(details.simulationAvailable, false);
  assert.equal(Object.hasOwn(details, "userId"), false);
  assert.deepEqual(details.countries.map((country) => country.code), ["ci"]);
  assert.equal(details.countries[0].flag, "🇨🇮");
  assert.deepEqual(details.countries[0].operators.map((operator) => operator.id), ["mtn-ci"]);
  assert.equal(details.countries[0].operators[0].initials, "MTN");
  assert.equal(details.countries[0].operators[0].logoUrl, null);

  const quote = await request(`/api/public/payment-links/${token}/quote/ci/mtn-ci`);
  assert.equal(quote.status, 200, quote.text);
  assert.deepEqual(json(quote), {
    currency: "XOF",
    amountMinor: 1250,
    totalMinor: 1250,
    operatorId: "mtn-ci",
  });
  const forgedNetwork = await request(`/api/public/payment-links/${token}/quote/ci/unknown`);
  assert.equal(forgedNetwork.status, 400);
  for (let index = 0; index < 28; index += 1) {
    const repeatedQuote = await request(`/api/public/payment-links/${token}/quote/ci/mtn-ci`);
    assert.equal(repeatedQuote.status, 200);
  }
  const rateLimitedQuote = await request(`/api/public/payment-links/${token}/quote/ci/mtn-ci`);
  assert.equal(rateLimitedQuote.status, 429);
  await owner.query("UPDATE sf_customer_payment_links SET expires_at=now() WHERE id=$1", [link.id]);
  const expiredPage = await request(`/api/public/payment-links/${token}`);
  assert.equal(expiredPage.status, 200, expiredPage.text);
  const expiredDetails = json(expiredPage);
  assert.equal(expiredDetails.state, "expired");
  assert.equal(expiredDetails.merchantName, "Flow digital SARL");
  assert.equal(expiredDetails.amountMinor, 1250);
  assert.equal(expiredDetails.paymentAvailable, false);
  assert.equal(expiredDetails.simulationAvailable, false);
  assert.deepEqual(expiredDetails.countries, []);
  await owner.query(
    "UPDATE sf_customer_payment_links SET expires_at=NULL, deleted_at=now() WHERE id=$1",
    [link.id],
  );
  const deletedPage = await request(`/api/public/payment-links/${token}`);
  assert.equal(deletedPage.status, 200, deletedPage.text);
  const deletedDetails = json(deletedPage);
  assert.equal(deletedDetails.state, "expired");
  assert.equal(deletedDetails.merchantName, "Flow digital SARL");
  assert.equal(deletedDetails.amountMinor, 1250);
  assert.equal(deletedDetails.paymentAvailable, false);
  assert.equal(deletedDetails.simulationAvailable, false);
  assert.deepEqual(deletedDetails.countries, []);
  const unknownToken = await request(
    "/api/public/payment-links/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );
  assert.equal(unknownToken.status, 404);
  await owner.query("DELETE FROM sf_customer_payment_links WHERE id=$1", [link.id]);
});

test("authorized Replit viewer can create, view and simulate a link without PIN or financial effects", async () => {
  const originalTarget = process.env.SENDFLOW_DATABASE_TARGET;
  const originalExecutionHost = process.env.FEEXPAY_EXECUTION_HOST;
  process.env.SENDFLOW_DATABASE_TARGET = "shared-neon";
  process.env.FEEXPAY_EXECUTION_HOST = "replit";
  const viewerId = "payment-link-viewer";
  let linkId;

  try {
    const attemptsBefore = await owner.query("SELECT count(*)::int AS count FROM sf_payment_attempts");
    const viewerList = await request("/api/me/payment-links", { userId: viewerId });
    assert.equal(viewerList.status, 200, viewerList.text);

    const created = await request("/api/me/payment-links", {
      method: "POST",
      userId: viewerId,
      body: validInput({
        linkName: "Simulation SendFlow",
        amount: "0",
        description: "",
      }),
    });
    assert.equal(created.status, 201, created.text);
    const link = json(created);
    linkId = link.id;
    const token = link.sharePath.split("/").at(-1);

    const page = await request(`/api/public/payment-links/${token}`, { userId: viewerId });
    assert.equal(page.status, 200, page.text);
    const details = json(page);
    assert.equal(details.paymentAvailable, false);
    assert.equal(details.simulationAvailable, true);

    const result = await request(`/api/me/payment-links/simulate/${token}`, {
      method: "POST",
      userId: viewerId,
      body: { amount: "2000" },
    });
    assert.equal(result.status, 200, result.text);
    assert.deepEqual(json(result), {
      mode: "simulation",
      status: "simulated_success",
      chargeOccurred: false,
      merchantName: "Simulation SendFlow",
      amountMinor: 2000,
      currency: "XOF",
      currencyDecimals: 0,
    });

    const wallet = await owner.query(
      "SELECT balance_minor FROM sf_wallets WHERE user_id=$1",
      [viewerId],
    );
    assert.equal(Number(wallet.rows[0]?.balance_minor), 0);
    const noProviderRecords = await owner.query(
      "SELECT count(*)::int AS count FROM sf_payment_attempts",
    );
    assert.equal(noProviderRecords.rows[0]?.count, attemptsBefore.rows[0]?.count);
  } finally {
    if (linkId) {
      await owner.query("DELETE FROM sf_customer_payment_links WHERE id=$1", [linkId]);
    }
    if (originalTarget === undefined) delete process.env.SENDFLOW_DATABASE_TARGET;
    else process.env.SENDFLOW_DATABASE_TARGET = originalTarget;
    if (originalExecutionHost === undefined) delete process.env.FEEXPAY_EXECUTION_HOST;
    else process.env.FEEXPAY_EXECUTION_HOST = originalExecutionHost;
  }
});

test("lists and pagination cursors are scoped to the authenticated owner", async () => {
  const created = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-owner-a",
    body: validInput({ currency: "USD", amount: "10.25" }),
  });
  assert.equal(created.status, 201, created.text);
  const ownerPage = await request("/api/me/payment-links", { userId: "payment-link-owner-a" });
  const ownerItems = json(ownerPage);
  assert.equal(ownerPage.status, 200);
  assert.equal(ownerItems.items.length, 2);
  assert.deepEqual(ownerItems.currencyOptions.map((item) => item.code), [
    "XOF", "XAF", "USD",
  ]);
  await owner.query(
    "UPDATE sf_customer_payment_links SET currency='EUR' WHERE id=$1",
    [json(created).id],
  );
  const legacyPage = json(await request("/api/me/payment-links", {
    userId: "payment-link-owner-a",
  }));
  const legacyLink = legacyPage.items.find((item) => item.id === json(created).id);
  assert.equal(legacyLink.currency, "EUR");
  assert.equal(legacyLink.currencyDecimals, 2);
  assert.deepEqual(legacyPage.currencyOptions.map((item) => item.code), [
    "XOF", "XAF", "USD",
  ]);
  const otherPage = await request("/api/me/payment-links", { userId: "payment-link-owner-b" });
  assert.equal(otherPage.status, 200);
  assert.deepEqual(json(otherPage).items, []);

  const firstPage = await request("/api/me/payment-links?limit=1", {
    userId: "payment-link-owner-a",
  });
  assert.equal(firstPage.status, 200);
  assert.equal(json(firstPage).items.length, 1);
  assert.ok(json(firstPage).nextCursor);
  const secondPage = await request(
    `/api/me/payment-links?limit=1&cursor=${json(firstPage).nextCursor}`,
    { userId: "payment-link-owner-a" },
  );
  assert.equal(secondPage.status, 200);
  assert.equal(json(secondPage).items.length, 1);
  assert.notEqual(json(secondPage).items[0].id, json(firstPage).items[0].id);

  const foreignCursor = await request(
    `/api/me/payment-links?cursor=${ownerItems.items[0].id}`,
    { userId: "payment-link-owner-b" },
  );
  assert.equal(foreignCursor.status, 400);
});

test("concurrent identical creates produce one row and the same idempotent result", async () => {
  const body = validInput({ currency: "USD", amount: "25.50" });
  const [first, second] = await Promise.all([
    request("/api/me/payment-links", {
      method: "POST", userId: "payment-link-concurrent", body,
    }),
    request("/api/me/payment-links", {
      method: "POST", userId: "payment-link-concurrent", body,
    }),
  ]);
  assert.equal(first.status, 201, first.text);
  assert.equal(second.status, 201, second.text);
  assert.equal(json(first).id, json(second).id);
  assert.equal(Number((await owner.query(
    "SELECT count(*)::int AS count FROM sf_customer_payment_links WHERE user_id='payment-link-concurrent'",
  )).rows[0].count), 1);
});

test("link creation is rate-limited per customer", async () => {
  const responses = [];
  for (let index = 0; index < 11; index += 1) {
    responses.push(await request("/api/me/payment-links", {
      method: "POST",
      userId: "payment-link-rate",
      body: validInput({ description: `Facture ${index}` }),
    }));
  }
  assert.deepEqual(responses.slice(0, 10).map((response) => response.status),
    Array(10).fill(201));
  assert.equal(responses[10].status, 429);
  assert.equal(Number((await owner.query(
    "SELECT count(*)::int AS count FROM sf_customer_payment_links WHERE user_id='payment-link-rate'",
  )).rows[0].count), 10);
});

test("link deletion preserves history, shows the expired landing page, and revokes checkout", async () => {
  const body = validInput({ maximumUses: 3 });
  const created = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-detail",
    body,
  });
  assert.equal(created.status, 201, created.text);
  const original = json(created);
  const linkId = original.id;
  const token = original.sharePath.split("/").at(-1);

  const details = await request(`/api/me/payment-links/${linkId}`, {
    userId: "payment-link-detail",
  });
  assert.equal(details.status, 200, details.text);
  assert.equal(json(details).linkName, body.linkName);
  assert.equal(json(details).amountMinor, 1250);

  const foreignDetails = await request(`/api/me/payment-links/${linkId}`, {
    userId: "payment-link-owner-b",
  });
  assert.equal(foreignDetails.status, 404);

  const missingCsrf = await request(`/api/me/payment-links/${linkId}`, {
    method: "PATCH",
    userId: "payment-link-detail",
    body: { amount: "1500" },
    csrf: false,
  });
  assert.equal(missingCsrf.status, 403);

  const updated = await request(`/api/me/payment-links/${linkId}`, {
    method: "PATCH",
    userId: "payment-link-detail",
    body: { amount: "1500", description: "Facture modifiée", maximumUses: 5 },
  });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(json(updated).amountMinor, 1500);
  assert.equal(json(updated).description, "Facture modifiée");
  assert.equal(json(updated).maximumUses, 5);

  await owner.query("UPDATE sf_customer_payment_links SET usage_count=1 WHERE id=$1", [linkId]);
  const amountAfterUse = await request(`/api/me/payment-links/${linkId}`, {
    method: "PATCH",
    userId: "payment-link-detail",
    body: { amount: "2000" },
  });
  assert.equal(amountAfterUse.status, 409);
  const limitAfterUse = await request(`/api/me/payment-links/${linkId}`, {
    method: "PATCH",
    userId: "payment-link-detail",
    body: { maximumUses: 2 },
  });
  assert.equal(limitAfterUse.status, 200, limitAfterUse.text);

  const foreignDelete = await request(`/api/me/payment-links/${linkId}`, {
    method: "DELETE",
    userId: "payment-link-owner-b",
  });
  assert.equal(foreignDelete.status, 404);
  const missingDeleteCsrf = await request(`/api/me/payment-links/${linkId}`, {
    method: "DELETE",
    userId: "payment-link-detail",
    csrf: false,
  });
  assert.equal(missingDeleteCsrf.status, 403);

  const deleted = await request(`/api/me/payment-links/${linkId}`, {
    method: "DELETE",
    userId: "payment-link-detail",
  });
  assert.equal(deleted.status, 204, deleted.text);
  const repeatedDelete = await request(`/api/me/payment-links/${linkId}`, {
    method: "DELETE",
    userId: "payment-link-detail",
  });
  assert.equal(repeatedDelete.status, 404);

  const hiddenDetails = await request(`/api/me/payment-links/${linkId}`, {
    userId: "payment-link-detail",
  });
  assert.equal(hiddenDetails.status, 404);
  const hiddenFromList = await request("/api/me/payment-links", {
    userId: "payment-link-detail",
  });
  assert.equal(json(hiddenFromList).items.some((item) => item.id === linkId), false);
  const publicCheckout = await request(`/api/public/payment-links/${token}`);
  assert.equal(publicCheckout.status, 200, publicCheckout.text);
  assert.equal(json(publicCheckout).state, "expired");
  assert.equal(json(publicCheckout).paymentAvailable, false);
  assert.deepEqual(json(publicCheckout).countries, []);
  const deletedQuote = await request(`/api/public/payment-links/${token}/quote/ci/mtn-ci`);
  assert.equal(deletedQuote.status, 404);

  const preserved = await owner.query(
    "SELECT deleted_at, amount_minor, usage_count FROM sf_customer_payment_links WHERE id=$1",
    [linkId],
  );
  assert.equal(preserved.rows.length, 1);
  assert.ok(preserved.rows[0].deleted_at);
  assert.equal(Number(preserved.rows[0].amount_minor), 1500);
  assert.equal(preserved.rows[0].usage_count, 1);

  const deletedReplay = await request("/api/me/payment-links", {
    method: "POST",
    userId: "payment-link-detail",
    body,
  });
  assert.equal(deletedReplay.status, 409);
});
