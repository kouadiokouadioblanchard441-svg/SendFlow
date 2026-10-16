import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const contactsTable = pgTable(
  "sf_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 512 }).notNull(),
    phone: varchar("phone", { length: 512 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    operator: varchar("operator", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userContactsIndex: index("sf_contacts_user_id_idx").on(table.userId),
  }),
);

export const insertContactSchema = createInsertSchema(contactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;