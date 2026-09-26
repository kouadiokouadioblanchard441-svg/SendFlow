import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const operatorOtpPoliciesTable = pgTable(
  "sf_operator_otp_policies",
  {
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    operatorId: varchar("operator_id", { length: 40 }).notNull(),
    requiresOtp: boolean("requires_otp").notNull(),
    version: integer("version").notNull().default(1),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    countryOperatorUnique: uniqueIndex("sf_operator_otp_policy_country_operator_uq").on(
      table.countryCode,
      table.operatorId,
    ),
  }),
);

export const insertOperatorOtpPolicySchema = createInsertSchema(operatorOtpPoliciesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertOperatorOtpPolicy = z.infer<typeof insertOperatorOtpPolicySchema>;
export type OperatorOtpPolicy = typeof operatorOtpPoliciesTable.$inferSelect;