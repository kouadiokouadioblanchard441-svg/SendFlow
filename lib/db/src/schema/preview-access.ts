import { createInsertSchema } from "drizzle-zod";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { usersTable } from "./users";

// A single, explicitly provisioned viewer. Never populated by public signup.
export const previewAccessTable = pgTable("sf_preview_access", {
  slot: integer("slot").primaryKey().default(1),
  userId: text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [
  check("sf_preview_access_single_viewer", sql`${t.slot} = 1`),
  check("sf_preview_access_valid_expiry", sql`${t.expiresAt} > ${t.createdAt}`),
]);
export const insertPreviewAccessSchema = createInsertSchema(previewAccessTable).omit({ createdAt: true });
export type InsertPreviewAccess = z.infer<typeof insertPreviewAccessSchema>;
export type PreviewAccess = typeof previewAccessTable.$inferSelect;
