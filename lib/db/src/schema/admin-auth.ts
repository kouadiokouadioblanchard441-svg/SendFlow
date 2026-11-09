import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const superAdminCredentialsTable = pgTable(
  "sf_super_admin_credentials",
  {
    id: smallint("id").primaryKey().default(1),
    emailNormalized: varchar("email_normalized", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    totpCiphertext: text("totp_ciphertext").notNull(),
    totpNonce: varchar("totp_nonce", { length: 24 }).notNull(),
    totpAuthTag: varchar("totp_auth_tag", { length: 32 }).notNull(),
    lastTotpStep: bigint("last_totp_step", { mode: "number" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  },
  (table) => ({
    singletonCheck: check("sf_super_admin_singleton_check", sql`${table.id} = 1`),
    normalizedEmailCheck: check(
      "sf_super_admin_email_normalized_check",
      sql`${table.emailNormalized} = lower(btrim(${table.emailNormalized}))`,
    ),
    emailUnique: uniqueIndex("sf_super_admin_email_uq").on(table.emailNormalized),
  }),
);

export const superAdminRecoveryCodesTable = pgTable(
  "sf_super_admin_recovery_codes",
  {
    credentialId: smallint("credential_id")
      .notNull()
      .default(1)
      .references(() => superAdminCredentialsTable.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => ({
    singletonCheck: check("sf_super_admin_recovery_credential_check", sql`${table.credentialId} = 1`),
    hashFormatCheck: check(
      "sf_super_admin_recovery_hash_check",
      sql`${table.codeHash} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const superAdminSessionsTable = pgTable(
  "sf_super_admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
    refreshFamilyId: uuid("refresh_family_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgentHash: varchar("user_agent_hash", { length: 64 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 80 }),
  },
  (table) => ({
    refreshTokenUnique: uniqueIndex("sf_super_admin_sessions_refresh_uq").on(table.refreshTokenHash),
    familyIndex: index("sf_super_admin_sessions_family_idx").on(table.refreshFamilyId),
    expiryIndex: index("sf_super_admin_sessions_expiry_idx").on(
      table.idleExpiresAt,
      table.absoluteExpiresAt,
    ),
    expiryCheck: check(
      "sf_super_admin_sessions_expiry_check",
      sql`${table.createdAt} < ${table.idleExpiresAt}
        and ${table.idleExpiresAt} <= ${table.absoluteExpiresAt}
        and ${table.createdAt} < ${table.absoluteExpiresAt}`,
    ),
    hashFormatCheck: check(
      "sf_super_admin_sessions_refresh_hash_check",
      sql`${table.refreshTokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const superAdminRefreshTokensTable = pgTable(
  "sf_super_admin_refresh_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => superAdminSessionsTable.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    replacedByHash: varchar("replaced_by_hash", { length: 64 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    familyIndex: index("sf_super_admin_refresh_family_idx").on(table.familyId, table.createdAt),
    sessionIndex: index("sf_super_admin_refresh_session_idx").on(table.sessionId, table.createdAt),
    tokenHashCheck: check(
      "sf_super_admin_refresh_hash_check",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    replacementHashCheck: check(
      "sf_super_admin_refresh_replacement_hash_check",
      sql`${table.replacedByHash} IS NULL OR ${table.replacedByHash} ~ '^[0-9a-f]{64}$'`,
    ),
  }),
);

export const superAdminStepUpTokensTable = pgTable(
  "sf_super_admin_step_up_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => superAdminSessionsTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    actionKey: varchar("action_key", { length: 128 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => ({
    tokenUnique: uniqueIndex("sf_super_admin_step_up_token_uq").on(table.tokenHash),
    sessionExpiryIndex: index("sf_super_admin_step_up_session_expiry_idx").on(
      table.sessionId,
      table.expiresAt,
    ),
    tokenHashCheck: check(
      "sf_super_admin_step_up_token_hash_check",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    payloadHashCheck: check(
      "sf_super_admin_step_up_payload_hash_check",
      sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
    expiryCheck: check("sf_super_admin_step_up_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
  }),
);

export type SuperAdminCredentials = typeof superAdminCredentialsTable.$inferSelect;
export type SuperAdminSession = typeof superAdminSessionsTable.$inferSelect;
