import {
  boolean,
  integer,
  pgTable,
  primaryKey,
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

export const landingMedia = pgTable(
  "landing_media",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    sourcePath: text("source_path").notNull(),
    storagePath: text("storage_path"),
    publicUrl: text("public_url"),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    altFr: text("alt_fr"),
    altEn: text("alt_en"),
    width: integer("width"),
    height: integer("height"),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("landing_media_slug_unique").on(table.slug),
  }),
);

export const landingContent = pgTable(
  "landing_content",
  {
    id: serial("id").primaryKey(),
    contentKey: varchar("content_key", { length: 160 }).notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    group: varchar("group", { length: 48 }).notNull(),
    contentType: varchar("content_type", { length: 24 }).default("text").notNull(),
    value: text("value").notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    contentLocaleUnique: uniqueIndex("landing_content_key_locale_unique").on(table.contentKey, table.locale),
  }),
);

export const landingSections = pgTable(
  "landing_sections",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    eyebrowFr: text("eyebrow_fr"),
    eyebrowEn: text("eyebrow_en"),
    titleFr: text("title_fr").notNull(),
    titleEn: text("title_en").notNull(),
    bodyFr: text("body_fr"),
    bodyEn: text("body_en"),
    imageKey: varchar("image_key", { length: 160 }),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("landing_sections_slug_unique").on(table.slug),
  }),
);

export const landingFeatures = pgTable(
  "landing_features",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    group: varchar("group", { length: 40 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    titleFr: text("title_fr").notNull(),
    titleEn: text("title_en").notNull(),
    bodyFr: text("body_fr").notNull(),
    bodyEn: text("body_en").notNull(),
    iconKey: varchar("icon_key", { length: 160 }),
    imageKey: varchar("image_key", { length: 160 }),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("landing_features_slug_unique").on(table.slug),
  }),
);

export const landingFaqs = pgTable(
  "landing_faqs",
  {
    id: serial("id").primaryKey(),
    orderIndex: integer("order_index").notNull(),
    questionFr: text("question_fr").notNull(),
    questionEn: text("question_en").notNull(),
    answerFr: text("answer_fr").notNull(),
    answerEn: text("answer_en").notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    orderUnique: uniqueIndex("landing_faqs_order_unique").on(table.orderIndex),
  }),
);

export const landingCountries = pgTable(
  "landing_countries",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 2 }).notNull(),
    nameFr: varchar("name_fr", { length: 100 }).notNull(),
    nameEn: varchar("name_en", { length: 100 }).notNull(),
    flag: varchar("flag", { length: 16 }).notNull(),
    tone: varchar("tone", { length: 32 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex("landing_countries_code_unique").on(table.code),
  }),
);

export const landingOperators = pgTable(
  "landing_operators",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    logoKey: varchar("logo_key", { length: 160 }),
    background: varchar("background", { length: 32 }),
    foreground: varchar("foreground", { length: 32 }),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("landing_operators_slug_unique").on(table.slug),
  }),
);

export const landingCountryOperators = pgTable(
  "landing_country_operators",
  {
    countryId: integer("country_id")
      .notNull()
      .references(() => landingCountries.id, { onDelete: "cascade" }),
    operatorId: integer("operator_id")
      .notNull()
      .references(() => landingOperators.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
  },
  (table) => ({
    countryOperatorPk: primaryKey({
      columns: [table.countryId, table.operatorId],
      name: "landing_country_operators_pk",
    }),
  }),
);

export const landingGlobeBadges = pgTable(
  "landing_globe_badges",
  {
    id: serial("id").primaryKey(),
    operatorId: integer("operator_id")
      .notNull()
      .references(() => landingOperators.id, { onDelete: "cascade" }),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    orderIndex: integer("order_index").notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    orderUnique: uniqueIndex("landing_globe_badges_order_unique").on(table.orderIndex),
  }),
);

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