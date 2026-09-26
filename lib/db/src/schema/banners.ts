import { createInsertSchema } from "drizzle-zod";
import { boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const bannersTable = pgTable(
  "sf_banners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url").notNull(),
    mobileImageUrl: text("mobile_image_url"),
    imageAlt: varchar("image_alt", { length: 180 }).notNull(),
    ctaLabel: varchar("cta_label", { length: 48 }),
    targetUrl: text("target_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    updatedBy: varchar("updated_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeOrderIndex: index("sf_banners_active_order_idx").on(table.isActive, table.sortOrder),
    scheduleIndex: index("sf_banners_schedule_idx").on(table.startsAt, table.endsAt),
  }),
);

export const insertBannerSchema = createInsertSchema(bannersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof bannersTable.$inferSelect;