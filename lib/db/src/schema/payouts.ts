import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { developerApiKeysTable } from "./developer-integrations";
import { countriesTable } from "./countries";
import { operatorCatalogTable } from "./operator-pricing";
import { usersTable } from "./users";
import { walletsTable } from "./wallets";
import { walletLedgerTable } from "./wallet-ledger";

export const payoutRequestsTable = pgTable("sf_payout_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: varchar("reference", { length: 30 }).notNull().unique(),
  merchantUserId: text("merchant_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  apiKeyId: uuid("api_key_id").notNull().references(() => developerApiKeysTable.id, { onDelete: "restrict" }),
  walletId: uuid("wallet_id").notNull().references(() => walletsTable.id, { onDelete: "restrict" }),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  merchantReference: varchar("merchant_reference", { length: 128 }),
  countryCode: varchar("country_code", { length: 2 }).notNull().references(() => countriesTable.countryCode, { onDelete: "restrict" }),
  operatorId: varchar("operator_id", { length: 60 }).notNull().references(() => operatorCatalogTable.operatorId, { onDelete: "restrict" }),
  beneficiaryPhoneEncrypted: text("beneficiary_phone_encrypted").notNull(),
  beneficiaryPhoneHash: varchar("beneficiary_phone_hash", { length: 64 }).notNull(),
  beneficiaryNameEncrypted: text("beneficiary_name_encrypted"),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
  feeRateUnits: integer("fee_rate_units").notNull(),
  feePayer: varchar("fee_payer", { length: 12 }).notNull(),
  feeMinor: bigint("fee_minor", { mode: "number" }).notNull(),
  totalDebitMinor: bigint("total_debit_minor", { mode: "number" }).notNull(),
  beneficiaryAmountMinor: bigint("beneficiary_amount_minor", { mode: "number" }).notNull(),
  pricingVersion: integer("pricing_version").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("created"),
  reservationState: varchar("reservation_state", { length: 12 }).notNull().default("none"),
  failureCode: varchar("failure_code", { length: 48 }),
  executionReferenceEncrypted: text("execution_reference_encrypted"),
  executionReferenceHash: varchar("execution_reference_hash", { length: 64 }),
  ledgerEntryId: uuid("ledger_entry_id").unique().references(() => walletLedgerTable.id, { onDelete: "restrict" }),
  finalConfirmationId: uuid("final_confirmation_id").references(
    (): AnyPgColumn => payoutConfirmationsTable.id,
    { onDelete: "restrict" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  reservedAt: timestamp("reserved_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  merchantIdempotencyUnique: unique("sf_payout_requests_merchant_idempotency_uq")
    .on(table.merchantUserId, table.idempotencyKey),
  merchantReferenceUnique: uniqueIndex("sf_payout_requests_merchant_reference_uq")
    .on(table.merchantUserId, table.merchantReference)
    .where(sql`${table.merchantReference} IS NOT NULL`),
  merchantCreatedIndex: index("sf_payout_requests_merchant_created_idx")
    .on(table.merchantUserId, table.createdAt, table.id),
  statusCreatedIndex: index("sf_payout_requests_status_created_idx")
    .on(table.status, table.createdAt),
  activeReservationIndex: index("sf_payout_requests_wallet_reservation_idx")
    .on(table.walletId)
    .where(sql`${table.reservationState} = 'active'`),
  executionReferenceHashUnique: uniqueIndex("sf_payout_requests_execution_reference_hash_uq")
    .on(table.executionReferenceHash)
    .where(sql`${table.executionReferenceHash} IS NOT NULL`),
  referenceFormatCheck: check("sf_payout_requests_reference_format_check", sql`${table.reference} ~ '^SFPO[A-F0-9]{16}$'`),
  idempotencyCheck: check("sf_payout_requests_idempotency_check", sql`length(btrim(${table.idempotencyKey})) BETWEEN 8 AND 128`),
  requestHashCheck: check("sf_payout_requests_request_hash_check", sql`${table.requestHash} ~ '^[a-f0-9]{64}$'`),
  merchantReferenceCheck: check("sf_payout_requests_merchant_reference_check",
    sql`${table.merchantReference} IS NULL OR (length(btrim(${table.merchantReference})) BETWEEN 1 AND 128 AND ${table.merchantReference} !~ '[[:cntrl:]]')`),
  beneficiaryPhoneCipherCheck: check("sf_payout_requests_phone_cipher_check",
    sql`${table.beneficiaryPhoneEncrypted} ~ '^sfenc-v2\\.[A-Za-z0-9_-]{1,32}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'`),
  beneficiaryPhoneHashCheck: check("sf_payout_requests_phone_hash_check",
    sql`${table.beneficiaryPhoneHash} ~ '^[a-f0-9]{64}$'`),
  beneficiaryNameCipherCheck: check("sf_payout_requests_name_cipher_check",
    sql`${table.beneficiaryNameEncrypted} IS NULL OR ${table.beneficiaryNameEncrypted} ~ '^sfenc-v2\\.[A-Za-z0-9_-]{1,32}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'`),
  amountCheck: check("sf_payout_requests_amount_check", sql`${table.amountMinor} BETWEEN 1 AND 9007199254740991`),
  currencyCheck: check("sf_payout_requests_currency_check", sql`${table.currency} = 'XOF'`),
  feeRateCheck: check("sf_payout_requests_fee_rate_check", sql`${table.feeRateUnits} BETWEEN 0 AND 1000000`),
  feePayerCheck: check("sf_payout_requests_fee_payer_check", sql`${table.feePayer} IN ('merchant','beneficiary')`),
  feeCheck: check("sf_payout_requests_fee_check", sql`${table.feeMinor} BETWEEN 0 AND 9007199254740991`),
  totalDebitCheck: check("sf_payout_requests_total_debit_check", sql`${table.totalDebitMinor} BETWEEN 1 AND 9007199254740991`),
  beneficiaryAmountCheck: check("sf_payout_requests_beneficiary_amount_check", sql`${table.beneficiaryAmountMinor} BETWEEN 1 AND 9007199254740991`),
  feeMathCheck: check("sf_payout_requests_fee_math_check", sql`
    (${table.feePayer} = 'merchant'
      AND ${table.totalDebitMinor} = ${table.amountMinor} + ${table.feeMinor}
      AND ${table.beneficiaryAmountMinor} = ${table.amountMinor})
    OR
    (${table.feePayer} = 'beneficiary'
      AND ${table.totalDebitMinor} = ${table.amountMinor}
      AND ${table.beneficiaryAmountMinor} = ${table.amountMinor} - ${table.feeMinor})
  `),
  pricingVersionCheck: check("sf_payout_requests_pricing_version_check", sql`${table.pricingVersion} >= 1`),
  statusCheck: check("sf_payout_requests_status_check", sql`${table.status} IN ('created','validated','funds_reserved','submitted','processing','succeeded','rejected','failed','uncertain','cancelled')`),
  reservationStateCheck: check("sf_payout_requests_reservation_state_check", sql`${table.reservationState} IN ('none','active','consumed','released')`),
  reservationStatusCheck: check("sf_payout_requests_reservation_status_check", sql`
    (${table.reservationState} = 'none' AND ${table.status} IN ('created','validated'))
    OR (${table.reservationState} = 'active' AND ${table.status} IN ('funds_reserved','submitted','processing','uncertain'))
    OR (${table.reservationState} = 'consumed' AND ${table.status} = 'succeeded')
    OR (${table.reservationState} = 'released' AND ${table.status} IN ('rejected','failed','cancelled'))
  `),
  failureCodeCheck: check("sf_payout_requests_failure_code_check", sql`${table.failureCode} IS NULL OR ${table.failureCode} IN ('merchant_rejected','admin_rejected','execution_rejected','execution_failed','insufficient_funds','daily_limit_exceeded','execution_unavailable')`),
  executionReferencePairCheck: check("sf_payout_requests_execution_reference_pair_check", sql`
    (${table.executionReferenceEncrypted} IS NULL AND ${table.executionReferenceHash} IS NULL)
    OR (${table.executionReferenceEncrypted} ~ '^sfenc-v2\\.[A-Za-z0-9_-]{1,32}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'
      AND ${table.executionReferenceHash} ~ '^[a-f0-9]{64}$')
  `),
  ledgerSuccessCheck: check("sf_payout_requests_ledger_success_check", sql`
    (${table.status} = 'succeeded' AND ${table.ledgerEntryId} IS NOT NULL AND ${table.finalConfirmationId} IS NOT NULL)
    OR (${table.status} <> 'succeeded' AND ${table.ledgerEntryId} IS NULL)
  `),
}));

export const payoutAttemptsTable = pgTable("sf_payout_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  payoutRequestId: uuid("payout_request_id").notNull().unique()
    .references(() => payoutRequestsTable.id, { onDelete: "restrict" }),
  operationReference: varchar("operation_reference", { length: 30 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull().default("prepared"),
  expectedExecutionAccountHash: varchar("expected_execution_account_hash", { length: 64 }).notNull(),
  expectedExecutionChannelId: varchar("expected_execution_channel_id", { length: 80 }).notNull(),
  executionReferenceEncrypted: text("execution_reference_encrypted"),
  executionReferenceHash: varchar("execution_reference_hash", { length: 64 }),
  finalConfirmationId: uuid("final_confirmation_id").references(
    (): AnyPgColumn => payoutConfirmationsTable.id,
    { onDelete: "restrict" },
  ),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIndex: index("sf_payout_attempts_status_idx").on(table.status, table.updatedAt),
  operationReferenceCheck: check("sf_payout_attempts_operation_reference_check", sql`${table.operationReference} ~ '^SFPO[A-F0-9]{16}$'`),
  statusCheck: check("sf_payout_attempts_status_check", sql`${table.status} IN ('prepared','dispatching','pending','uncertain','succeeded','failed')`),
  expectedExecutionAccountHashCheck: check("sf_payout_attempts_expected_execution_account_hash_check",
    sql`${table.expectedExecutionAccountHash} ~ '^[a-f0-9]{64}$'`),
  expectedExecutionChannelCheck: check("sf_payout_attempts_expected_execution_channel_check",
    sql`length(btrim(${table.expectedExecutionChannelId})) BETWEEN 1 AND 80`),
  executionReferencePairCheck: check("sf_payout_attempts_execution_reference_pair_check", sql`
    (${table.executionReferenceEncrypted} IS NULL AND ${table.executionReferenceHash} IS NULL)
    OR (${table.executionReferenceEncrypted} ~ '^sfenc-v2\\.[A-Za-z0-9_-]{1,32}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'
      AND ${table.executionReferenceHash} ~ '^[a-f0-9]{64}$')
  `),
}));

export const payoutConfirmationsTable = pgTable("sf_payout_confirmations", {
  id: uuid("id").defaultRandom().primaryKey(),
  payoutRequestId: uuid("payout_request_id").notNull().references(() => payoutRequestsTable.id, { onDelete: "restrict" }),
  attemptId: uuid("attempt_id").notNull().unique().references(() => payoutAttemptsTable.id, { onDelete: "restrict" }),
  verificationSource: varchar("verification_source", { length: 24 }).notNull(),
  executionStatus: varchar("execution_status", { length: 16 }).notNull(),
  executionReferenceHash: varchar("execution_reference_hash", { length: 64 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  executionAccountHash: varchar("execution_account_hash", { length: 64 }).notNull(),
  executionChannelId: varchar("execution_channel_id", { length: 80 }).notNull(),
  operation: varchar("operation", { length: 8 }).notNull().default("payout"),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  operatorId: varchar("operator_id", { length: 60 }).notNull(),
  beneficiaryPhoneHash: varchar("beneficiary_phone_hash", { length: 64 }),
  verificationPassed: boolean("verification_passed").notNull().default(false),
  evidenceEncrypted: text("evidence_encrypted").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  payoutConfirmationUnique: unique("sf_payout_confirmations_request_uq").on(table.payoutRequestId),
  amountCheck: check("sf_payout_confirmations_amount_check", sql`${table.amountMinor} BETWEEN 1 AND 9007199254740991`),
  currencyCheck: check("sf_payout_confirmations_currency_check", sql`${table.currency} = 'XOF'`),
  executionReferenceHashCheck: check("sf_payout_confirmations_execution_reference_hash_check", sql`${table.executionReferenceHash} ~ '^[a-f0-9]{64}$'`),
  executionAccountHashCheck: check("sf_payout_confirmations_execution_account_hash_check", sql`${table.executionAccountHash} ~ '^[a-f0-9]{64}$'`),
  executionChannelIdCheck: check("sf_payout_confirmations_execution_channel_check", sql`length(btrim(${table.executionChannelId})) BETWEEN 1 AND 80`),
  operationCheck: check("sf_payout_confirmations_operation_check", sql`${table.operation} = 'payout'`),
  beneficiaryHashCheck: check("sf_payout_confirmations_beneficiary_hash_check", sql`${table.beneficiaryPhoneHash} ~ '^[a-f0-9]{64}$'`),
  verificationCheck: check("sf_payout_confirmations_verification_check", sql`${table.verificationPassed} = true`),
  executionStatusCheck: check("sf_payout_confirmations_execution_status_check", sql`${table.executionStatus} IN ('SUCCEEDED','FAILED')`),
  verificationSourceCheck: check("sf_payout_confirmations_source_check", sql`${table.verificationSource} IN ('status_check','signed_event')`),
  evidenceCipherCheck: check("sf_payout_confirmations_evidence_cipher_check",
    sql`${table.evidenceEncrypted} ~ '^sfenc-v2\\.[A-Za-z0-9_-]{1,32}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]+$'`),
}));

export const payoutStateEventsTable = pgTable("sf_payout_state_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  payoutRequestId: uuid("payout_request_id").notNull().references(() => payoutRequestsTable.id, { onDelete: "restrict" }),
  fromStatus: varchar("from_status", { length: 24 }),
  toStatus: varchar("to_status", { length: 24 }).notNull(),
  actorType: varchar("actor_type", { length: 16 }).notNull(),
  actorId: varchar("actor_id", { length: 255 }),
  reasonCode: varchar("reason_code", { length: 48 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  payoutCreatedIndex: index("sf_payout_state_events_payout_created_idx").on(table.payoutRequestId, table.createdAt, table.id),
  actorCheck: check("sf_payout_state_events_actor_check", sql`${table.actorType} IN ('merchant','admin','system')`),
  reasonCheck: check("sf_payout_state_events_reason_check", sql`${table.reasonCode} ~ '^[a-z0-9_:-]{1,48}$'`),
}));

export const insertPayoutRequestSchema = createInsertSchema(payoutRequestsTable);
export type PayoutRequest = typeof payoutRequestsTable.$inferSelect;
export type InsertPayoutRequest = typeof payoutRequestsTable.$inferInsert;
export type PayoutAttempt = typeof payoutAttemptsTable.$inferSelect;
export type PayoutConfirmation = typeof payoutConfirmationsTable.$inferSelect;
export type PayoutStateEvent = typeof payoutStateEventsTable.$inferSelect;
