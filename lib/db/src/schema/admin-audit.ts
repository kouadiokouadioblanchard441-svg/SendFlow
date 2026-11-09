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
  | "admin_sign_in"
  | "admin_sign_out"
  | "admin_pin_unlock"
  | "admin_pin_failure"
  | "provision_admin"
  | "revoke_admin"
  | "allow_network_ip"
  | "authorize_release_network_ip"
  | "revoke_network_allow"
  | "release_automatic_ip"
  | "view_network_defense"
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
  | "update_ussd_instruction"
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
  | "update_operator_logo"
  | "create_country"
  | "update_country"
  | "delete_country"
  | "view_countries"
  | "delete_operator"
  | "update_operator_pricing"
  | "update_registration_settings"
  | "update_payment_limits"
  | "update_user_monthly_incoming_limit"
  | "view_email_campaign_recipients"
  | "view_email_campaigns"
  | "create_email_campaign"
  | "update_email_campaign"
  | "queue_email_campaign"
  | "cancel_email_campaign"
  | "delete_email_campaign"
  | "retry_email_campaign_recipient"
  | "update_customer_service_settings"
  | "view_developer_webhooks"
  | "view_identity_verification"
  | "view_payout_queue"
  | "view_payout"
  | "reject_undispatched_payout"
  | "download_identity_verification"
  | "decide_identity_verification";
export type AdminAuditResourceType =
  | "admin_access"
  | "network_defense"
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
  | "country"
  | "operator_pricing"
  | "registration_settings"
  | "payment_limits"
  | "email_campaign"
  | "customer_service_settings"
  | "developer_webhook"
  | "identity_verification"
  | "payout";