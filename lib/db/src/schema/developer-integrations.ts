import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { customerPaymentLinksTable } from "./payment-links";

export const developerApiKeysTable = pgTable("sf_developer_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  label: varchar("label", { length: 80 }).notNull(),
  publicKey: varchar("public_key", { length: 80 }).notNull().unique(),
  publicKeyPrefix: varchar("public_key_prefix", { length: 32 }).notNull(),
  publicKeyHash: varchar("public_key_hash", { length: 64 }).notNull().unique(),
  secretKeyPrefix: varchar("secret_key_prefix", { length: 32 }).notNull(),
  secretKeyHash: varchar("secret_key_hash", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 12 }).notNull().default("active"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerCreatedIndex: index("sf_developer_api_keys_owner_created_idx").on(table.userId, table.createdAt),
  statusCheck: check("sf_developer_api_keys_status_check", sql`${table.status} in ('active','revoked')`),
  labelCheck: check("sf_developer_api_keys_label_check", sql`length(btrim(${table.label})) between 1 and 80`),
  publicPrefixCheck: check("sf_developer_api_keys_public_prefix_check", sql`${table.publicKeyPrefix} ~ '^sfpk_[A-Za-z0-9_-]{8,24}$'`),
  publicHashCheck: check("sf_developer_api_keys_public_hash_check", sql`${table.publicKeyHash} ~ '^[a-f0-9]{64}$'`),
  publicKeyCheck: check("sf_developer_api_keys_public_key_check", sql`${table.publicKey} ~ '^sfpk_(live|test)_[A-Za-z0-9_-]{43}$'`),
  secretPrefixCheck: check("sf_developer_api_keys_secret_prefix_check", sql`${table.secretKeyPrefix} ~ '^sfsk_[A-Za-z0-9_-]{8,24}$'`),
  secretHashCheck: check("sf_developer_api_keys_secret_hash_check", sql`${table.secretKeyHash} ~ '^[a-f0-9]{64}$'`),
  revokePairCheck: check("sf_developer_api_keys_revoke_pair_check", sql`(${table.status}='active' and ${table.revokedAt} is null) or (${table.status}='revoked' and ${table.revokedAt} is not null)`),
}));

export const developerPaymentSessionsTable = pgTable("sf_developer_payment_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  apiKeyId: uuid("api_key_id").notNull().references(() => developerApiKeysTable.id, { onDelete: "restrict" }),
  paymentLinkId: uuid("payment_link_id").notNull().unique()
    .references(() => customerPaymentLinksTable.id, { onDelete: "restrict" }),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  merchantReference: varchar("merchant_reference", { length: 128 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  clientTokenHash: varchar("client_token_hash", { length: 64 }).notNull().unique(),
  clientTokenEncrypted: text("client_token_encrypted").notNull(),
  mode: varchar("mode", { length: 12 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  metadataEncrypted: text("metadata_encrypted").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerIdempotencyUnique: unique("sf_developer_payment_sessions_owner_idempotency_uq")
    .on(table.userId, table.idempotencyKey),
  ownerReferenceUnique: unique("sf_developer_payment_sessions_owner_reference_uq")
    .on(table.userId, table.merchantReference),
  ownerCreatedIndex: index("sf_developer_payment_sessions_owner_created_idx")
    .on(table.userId, table.createdAt, table.id),
  requestHashCheck: check("sf_developer_payment_sessions_request_hash_check", sql`${table.requestHash} ~ '^[a-f0-9]{64}$'`),
  clientTokenHashCheck: check("sf_developer_payment_sessions_client_token_hash_check", sql`${table.clientTokenHash} ~ '^[a-f0-9]{64}$'`),
  clientTokenCipherCheck: check("sf_developer_payment_sessions_client_token_cipher_check", sql`${table.clientTokenEncrypted} ~ '^sfenc-v1\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'`),
  modeCheck: check("sf_developer_payment_sessions_mode_check", sql`${table.mode} in ('hosted','direct')`),
  amountCheck: check("sf_developer_payment_sessions_amount_check", sql`${table.amountMinor} between 200 and 2000000`),
  currencyCheck: check("sf_developer_payment_sessions_currency_check", sql`${table.currency}='XOF'`),
  idempotencyKeyCheck: check("sf_developer_payment_sessions_idempotency_check", sql`length(btrim(${table.idempotencyKey})) between 8 and 128`),
  merchantReferenceCheck: check("sf_developer_payment_sessions_reference_check", sql`length(btrim(${table.merchantReference})) between 1 and 128`),
  metadataCipherCheck: check("sf_developer_payment_sessions_metadata_cipher_check", sql`${table.metadataEncrypted} ~ '^sfenc-v1\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'`),
}));

export const developerWebhookEndpointsTable = pgTable("sf_developer_webhook_endpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  label: varchar("label", { length: 80 }).notNull(),
  urlEncrypted: text("url_encrypted").notNull(),
  events: text("events").array().notNull(),
  signingSecretEncrypted: text("signing_secret_encrypted").notNull(),
  status: varchar("status", { length: 12 }).notNull().default("active"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerCreatedIndex: index("sf_developer_webhook_endpoints_owner_created_idx").on(table.userId, table.createdAt),
  urlCipherCheck: check("sf_developer_webhook_endpoints_url_cipher_check", sql`${table.urlEncrypted} ~ '^sfenc-v1\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'`),
  eventsCheck: check("sf_developer_webhook_endpoints_events_check", sql`cardinality(${table.events}) between 1 and 2 and ${table.events} <@ ARRAY['payment.succeeded','payment.failed']::text[]`),
  secretCipherCheck: check("sf_developer_webhook_endpoints_secret_cipher_check", sql`${table.signingSecretEncrypted} ~ '^sfenc-v1\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'`),
  statusCheck: check("sf_developer_webhook_endpoints_status_check", sql`${table.status} in ('active','revoked')`),
  revokePairCheck: check("sf_developer_webhook_endpoints_revoke_pair_check", sql`(${table.status}='active' and ${table.revokedAt} is null) or (${table.status}='revoked' and ${table.revokedAt} is not null)`),
  labelCheck: check("sf_developer_webhook_endpoints_label_check", sql`length(btrim(${table.label})) between 1 and 80`),
}));

export const developerWebhookDeliveriesTable = pgTable("sf_developer_webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  endpointId: uuid("endpoint_id").notNull()
    .references(() => developerWebhookEndpointsTable.id, { onDelete: "restrict" }),
  paymentSessionId: uuid("payment_session_id").notNull()
    .references(() => developerPaymentSessionsTable.id, { onDelete: "restrict" }),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: varchar("status", { length: 12 }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastHttpStatus: varchar("last_http_status", { length: 3 }),
  lastErrorClass: varchar("last_error_class", { length: 40 }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  endpointSessionEventUnique: unique("sf_developer_webhook_deliveries_event_uq")
    .on(table.endpointId, table.paymentSessionId, table.eventType),
  dueIndex: index("sf_developer_webhook_deliveries_due_idx")
    .on(table.status, table.nextAttemptAt, table.createdAt),
  payloadSizeCheck: check("sf_developer_webhook_deliveries_payload_check", sql`octet_length(${table.payload}::text) <= 16384`),
  eventCheck: check("sf_developer_webhook_deliveries_event_check", sql`${table.eventType} in ('payment.succeeded','payment.failed')`),
  statusCheck: check("sf_developer_webhook_deliveries_status_check", sql`${table.status} in ('pending','delivering','delivered','failed')`),
  attemptsCheck: check("sf_developer_webhook_deliveries_attempts_check", sql`${table.attempts} between 0 and 100`),
}));

export const insertDeveloperApiKeySchema = createInsertSchema(developerApiKeysTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDeveloperPaymentSessionSchema = createInsertSchema(developerPaymentSessionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertDeveloperWebhookEndpointSchema = createInsertSchema(developerWebhookEndpointsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDeveloperWebhookDeliverySchema = createInsertSchema(developerWebhookDeliveriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DeveloperApiKey = typeof developerApiKeysTable.$inferSelect;
export type DeveloperPaymentSession = typeof developerPaymentSessionsTable.$inferSelect;
export type DeveloperWebhookEndpoint = typeof developerWebhookEndpointsTable.$inferSelect;
export type DeveloperWebhookDelivery = typeof developerWebhookDeliveriesTable.$inferSelect;
