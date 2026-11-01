import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type CustomerIdentityRequestStatus = "pending" | "approved" | "rejected";
export type CustomerIdentityDocumentKind = "front" | "back" | "selfie";

export const customerIdentityRequestsTable = pgTable(
  "sf_customer_identity_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
    personalDataEncrypted: text("personal_data_encrypted").notNull(),
    status: text("status")
      .$type<CustomerIdentityRequestStatus>()
      .notNull()
      .default("pending"),
    decisionReasonEncrypted: text("decision_reason_encrypted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusConstraint: check(
      "sf_customer_identity_requests_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected')`,
    ),
    idempotencyUnique: uniqueIndex("sf_customer_identity_requests_user_idempotency_uq").on(
      table.userId,
      table.idempotencyKey,
    ),
    onePendingPerUser: uniqueIndex("sf_customer_identity_requests_one_pending_uq")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
    userSubmittedIndex: index("sf_customer_identity_requests_user_submitted_idx").on(
      table.userId,
      table.submittedAt,
    ),
  }),
);

export const customerIdentityUploadsTable = pgTable(
  "sf_customer_identity_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").references(() => customerIdentityRequestsTable.id, {
      onDelete: "restrict",
    }),
    kind: text("kind").$type<CustomerIdentityDocumentKind>().notNull(),
    objectPath: text("object_path").notNull().unique(),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    expectedSizeBytes: integer("expected_size_bytes").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    kindConstraint: check(
      "sf_customer_identity_uploads_kind_check",
      sql`${table.kind} in ('front', 'back', 'selfie')`,
    ),
    sizeConstraint: check(
      "sf_customer_identity_uploads_size_check",
      sql`${table.expectedSizeBytes} between 1 and 8388608`,
    ),
    pendingExpiryIndex: index("sf_customer_identity_uploads_pending_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.requestId} is null`),
    requestKindUnique: uniqueIndex("sf_customer_identity_uploads_request_kind_uq")
      .on(table.requestId, table.kind)
      .where(sql`${table.requestId} is not null`),
  }),
);

export type CustomerIdentityRequest = typeof customerIdentityRequestsTable.$inferSelect;
export type CustomerIdentityUpload = typeof customerIdentityUploadsTable.$inferSelect;
