import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { developerPaymentSessionsTable, developerWebhookEndpointsTable } from "./developer-integrations";
import { payoutRequestsTable, payoutStateEventsTable } from "./payouts";

export const developerWebhookDeliveriesTable = pgTable("sf_developer_webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  endpointId: uuid("endpoint_id").notNull()
    .references(() => developerWebhookEndpointsTable.id, { onDelete: "restrict" }),
  paymentSessionId: uuid("payment_session_id")
    .references(() => developerPaymentSessionsTable.id, { onDelete: "restrict" }),
  payoutRequestId: uuid("payout_request_id")
    .references(() => payoutRequestsTable.id, { onDelete: "restrict" }),
  payoutStateEventId: uuid("payout_state_event_id")
    .references(() => payoutStateEventsTable.id, { onDelete: "restrict" }),
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
  endpointSessionEventUnique: uniqueIndex("sf_developer_webhook_deliveries_payment_event_uq")
    .on(table.endpointId, table.paymentSessionId, table.eventType)
    .where(sql`${table.paymentSessionId} IS NOT NULL`),
  endpointPayoutEventUnique: uniqueIndex("sf_developer_webhook_deliveries_payout_event_uq")
    .on(table.endpointId, table.payoutRequestId, table.payoutStateEventId)
    .where(sql`${table.payoutRequestId} IS NOT NULL`),
  dueIndex: index("sf_developer_webhook_deliveries_due_idx")
    .on(table.status, table.nextAttemptAt, table.createdAt),
  payloadSizeCheck: check("sf_developer_webhook_deliveries_payload_check", sql`octet_length(${table.payload}::text) <= 16384`),
  entityCheck: check("sf_developer_webhook_deliveries_entity_check", sql`
    (${table.paymentSessionId} IS NOT NULL AND ${table.payoutRequestId} IS NULL AND ${table.payoutStateEventId} IS NULL)
    OR
    (${table.paymentSessionId} IS NULL AND ${table.payoutRequestId} IS NOT NULL AND ${table.payoutStateEventId} IS NOT NULL)
  `),
  eventCheck: check("sf_developer_webhook_deliveries_event_check", sql`${table.eventType} IN (
    'payment.succeeded','payment.failed',
    'payout.created','payout.processing','payout.succeeded','payout.failed','payout.uncertain'
  )`),
  statusCheck: check("sf_developer_webhook_deliveries_status_check", sql`${table.status} IN ('pending','delivering','delivered','failed')`),
  attemptsCheck: check("sf_developer_webhook_deliveries_attempts_check", sql`${table.attempts} BETWEEN 0 AND 100`),
}));

export const insertDeveloperWebhookDeliverySchema = createInsertSchema(developerWebhookDeliveriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DeveloperWebhookDelivery = typeof developerWebhookDeliveriesTable.$inferSelect;
