import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const legalPages = pgTable(
  "legal_pages",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    titleFr: text("title_fr").notNull(),
    titleEn: text("title_en").notNull(),
    introFr: text("intro_fr").notNull(),
    introEn: text("intro_en").notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("legal_pages_slug_unique").on(table.slug),
  }),
);

export const legalSections = pgTable(
  "legal_sections",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => legalPages.id, { onDelete: "cascade" }),
    sectionNumber: integer("section_number").notNull(),
    titleFr: text("title_fr").notNull(),
    titleEn: text("title_en").notNull(),
    bodyFr: text("body_fr").notNull(),
    bodyEn: text("body_en").notNull(),
    orderIndex: integer("order_index").notNull(),
    ...timestamps,
  },
  (table) => ({
    pageOrderUnique: uniqueIndex("legal_sections_page_order_unique").on(table.pageId, table.orderIndex),
  }),
);