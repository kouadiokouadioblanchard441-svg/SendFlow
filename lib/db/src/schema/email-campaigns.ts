import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const emailCampaignsTable = pgTable(
  "sf_email_campaigns",
  {
    id: text("id").primaryKey(),
    subject: varchar("subject", { length: 200 }).notNull(),
    bodyText: text("body_text").notNull(),
    audienceMode: varchar("audience_mode", { length: 16 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    recipientCount: integer("recipient_count").notNull().default(0),
    unverifiedRecipientCount: integer("unverified_recipient_count").notNull().default(0),
    createdBy: text("created_by").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    subjectNonBlankCheck: check("sf_email_campaign_subject_nonblank", sql`length(btrim(${table.subject})) > 0`),
    audienceModeCheck: check("sf_email_campaign_audience_check", sql`${table.audienceMode} in ('all', 'selected')`),
    statusCheck: check(
      "sf_email_campaign_status_check",
      sql`${table.status} in ('draft', 'queued', 'sending', 'completed', 'completed_with_errors', 'cancelled')`,
    ),
    createdIndex: index("sf_email_campaign_created_idx").on(table.createdAt),
    statusIndex: index("sf_email_campaign_status_idx").on(table.status, table.queuedAt),
  }),
);

export const emailCampaignRecipientsTable = pgTable(
  "sf_email_campaign_recipients",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => emailCampaignsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    lastErrorClass: varchar("last_error_class", { length: 32 }),
    lastErrorStatus: integer("last_error_status"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignUserUnique: uniqueIndex("sf_email_campaign_recipient_uq").on(table.campaignId, table.userId),
    queueIndex: index("sf_email_campaign_recipient_queue_idx").on(table.status, table.nextAttemptAt, table.createdAt),
    campaignStatusIndex: index("sf_email_campaign_recipient_campaign_status_idx").on(table.campaignId, table.status),
    attemptsCheck: check("sf_email_campaign_recipient_attempts_check", sql`${table.attempts} >= 0`),
    statusCheck: check(
      "sf_email_campaign_recipient_status_check",
      sql`${table.status} in ('draft', 'queued', 'sending', 'accepted', 'failed', 'cancelled')`,
    ),
  }),
);
