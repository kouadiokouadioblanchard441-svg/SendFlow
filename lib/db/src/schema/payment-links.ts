import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const customerPaymentLinksTable = pgTable("sf_customer_payment_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  publicToken: varchar("public_token", { length: 43 }).notNull(),
  idempotencyKey: uuid("idempotency_key").notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  linkName: varchar("link_name", { length: 120 }),
  description: varchar("description", { length: 240 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  source: varchar("source", { length: 12 }).notNull().default("linkflow"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maximumUses: integer("maximum_uses"),
  usageCount: integer("usage_count").notNull().default(0),
  returnUrl: varchar("return_url", { length: 2048 }),
  customSuffix: varchar("custom_suffix", { length: 32 }),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  imageData: bytea("image_data"),
  imageSizeBytes: integer("image_size_bytes"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerCreatedIndex: index("sf_customer_payment_links_owner_created_idx")
    .on(table.userId, table.createdAt, table.id),
  publicTokenUnique: uniqueIndex("sf_customer_payment_links_public_token_uq")
    .on(table.publicToken),
  ownerIdempotencyUnique: uniqueIndex("sf_customer_payment_links_owner_idempotency_uq")
    .on(table.userId, table.idempotencyKey),
  tokenFormat: check(
    "sf_customer_payment_links_token_check",
    sql`${table.publicToken} ~ '^[A-Za-z0-9_-]{43}$'`,
  ),
  requestHashFormat: check(
    "sf_customer_payment_links_request_hash_check",
    sql`${table.requestHash} ~ '^[a-f0-9]{64}$'`,
  ),
  currencyCheck: check(
    "sf_customer_payment_links_currency_check",
    sql`${table.currency} in ('XOF','XAF','CHF','NGN','EUR','USD','CAD')`,
  ),
  amountCheck: check(
    "sf_customer_payment_links_amount_check",
    sql`(${table.currency} = 'XOF' and ${table.amountMinor} between 0 and 9007199254740991)
      or (${table.currency} = 'XAF' and ${table.amountMinor} between 10 and 9007199254740991)
      or (${table.currency} in ('CHF','NGN','EUR','USD','CAD') and ${table.amountMinor} between 1000 and 9007199254740991)`,
  ),
  descriptionCheck: check(
    "sf_customer_payment_links_description_check",
    sql`length(btrim(${table.description})) between 0 and 240`,
  ),
  linkNameCheck: check(
    "sf_customer_payment_links_link_name_check",
    sql`${table.linkName} is null or length(btrim(${table.linkName})) between 2 and 120`,
  ),
  paymentMethodCheck: check(
    "sf_customer_payment_links_payment_method_check",
    sql`${table.paymentMethod} in ('mobile_money','card','all')`,
  ),
  sourceCheck: check(
    "sf_customer_payment_links_source_check",
    sql`${table.source} in ('linkflow','api')`,
  ),
  maximumUsesCheck: check(
    "sf_customer_payment_links_maximum_uses_check",
    sql`${table.maximumUses} is null or ${table.maximumUses} between 1 and 999999`,
  ),
  usageCountCheck: check(
    "sf_customer_payment_links_usage_count_check",
    sql`${table.usageCount} between 0 and 999999 and (${table.maximumUses} is null or ${table.usageCount} <= ${table.maximumUses})`,
  ),
  suffixCheck: check(
    "sf_customer_payment_links_suffix_check",
    sql`${table.customSuffix} is null or ${table.customSuffix} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
  ),
  returnUrlCheck: check(
    "sf_customer_payment_links_return_url_check",
    sql`${table.returnUrl} is null or ${table.returnUrl} ~ '^https://'`,
  ),
  statusCheck: check(
    "sf_customer_payment_links_status_check",
    sql`${table.status} in ('draft','active','paused','expired','exhausted')`,
  ),
  imageDataCheck: check(
    "sf_customer_payment_links_image_data_check",
    sql`(${table.imageData} is null and ${table.imageSizeBytes} is null)
      or (${table.imageData} is not null and ${table.imageSizeBytes} between 1 and 5242880
        and octet_length(${table.imageData}) = ${table.imageSizeBytes})`,
  ),
}));

export const insertCustomerPaymentLinkSchema = createInsertSchema(customerPaymentLinksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomerPaymentLink = typeof customerPaymentLinksTable.$inferSelect;
export type InsertCustomerPaymentLink = typeof customerPaymentLinksTable.$inferInsert;
