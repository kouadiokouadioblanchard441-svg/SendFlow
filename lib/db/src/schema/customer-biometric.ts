import { createInsertSchema } from "drizzle-zod";
import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { customerSessionsTable } from "./customer-sessions";

export const customerBiometricCredentialsTable = pgTable(
  "sf_customer_biometric_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    rpId: text("rp_id").notNull(),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).notNull().default(0),
    transports: text("transports").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    credentialIdUniqueIndex: uniqueIndex("sf_customer_biometric_credential_id_uq").on(table.credentialId),
    userCreatedIndex: index("sf_customer_biometric_user_created_idx").on(table.userId, table.createdAt),
    userRpIdIndex: index("sf_customer_biometric_user_rp_idx").on(table.userId, table.rpId),
  }),
);

export const customerBiometricChallengesTable = pgTable(
  "sf_customer_biometric_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => customerSessionsTable.id, { onDelete: "cascade" }),
    challenge: text("challenge").notNull(),
    purpose: varchar("purpose", { length: 20 }).notNull(),
    expectedOrigin: text("expected_origin").notNull(),
    rpId: text("rp_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionExpiryIndex: index("sf_customer_biometric_challenge_session_expiry_idx").on(
      table.sessionId,
      table.expiresAt,
    ),
  }),
);

export const insertCustomerBiometricCredentialSchema = createInsertSchema(customerBiometricCredentialsTable).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const insertCustomerBiometricChallengeSchema = createInsertSchema(customerBiometricChallengesTable).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type CustomerBiometricCredential = typeof customerBiometricCredentialsTable.$inferSelect;
export type CustomerBiometricChallenge = typeof customerBiometricChallengesTable.$inferSelect;
export type InsertCustomerBiometricCredential = z.infer<typeof insertCustomerBiometricCredentialSchema>;
export type InsertCustomerBiometricChallenge = z.infer<typeof insertCustomerBiometricChallengeSchema>;
