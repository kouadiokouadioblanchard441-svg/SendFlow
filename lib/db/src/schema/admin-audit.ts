import { bigint, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const adminAuditLogsTable = pgTable(
  "sf_admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: varchar("admin_user_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 32 }).notNull(),
    resourceId: text("resource_id").notNull(),
    reason: varchar("reason", { length: 500 }),
    amountMinor: bigint("amount_minor", { mode: "number" }),
    currency: varchar("currency", { length: 3 }),
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

export type AdminAuditAction =
  | "block_ip"
  | "unblock_ip"
  | "view_ip_blocklist"
  | "view_admin_overview"
  | "view_user_list"
  | "view_user_detail"
  | "view_transaction_list"
  | "view_transaction_detail"
  | "credit_wallet"
  | "debit_wallet"
  | "suspend_user"
  | "restore_user"
  | "delete_user"
  | "archive_transaction"
  | "view_login_activity"
  | "view_otp_activity"
  | "view_otp_policies"
  | "view_payment_routing"
  | "create_banner"
  | "create_payment_aggregator"
  | "update_banner"
  | "delete_banner"
  | "update_otp_policy"
  | "update_payment_aggregator"
  | "update_payment_route"
  | "view_operator_pricing"
  | "create_operator"
  | "update_operator"
  | "update_operator_pricing"
  | "update_registration_settings";
export type AdminAuditResourceType =
  | "ip_block"
  | "dashboard"
  | "user"
  | "transaction"
  | "wallet"
  | "login_activity"
  | "otp_activity"
  | "banner"
  | "otp_policy"
  | "payment_aggregator"
  | "payment_route"
  | "operator"
  | "operator_pricing"
  | "registration_settings";