import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const adminAuditLogsTable = pgTable(
  "sf_admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: varchar("admin_user_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 32 }).notNull(),
    resourceId: text("resource_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    adminCreatedIndex: index("sf_admin_audit_admin_created_idx").on(table.adminUserId, table.createdAt),
    resourceCreatedIndex: index("sf_admin_audit_resource_created_idx").on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
  }),
);

export type AdminAuditAction = "view_user_detail" | "view_transaction_detail";
export type AdminAuditResourceType = "user" | "transaction";