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

export const landingFounderProfile = pgTable(
  "landing_founder_profile",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    roleFr: text("role_fr").notNull(),
    roleEn: text("role_en").notNull(),
    shortBioFr: text("short_bio_fr").notNull(),
    shortBioEn: text("short_bio_en").notNull(),
    storyFr: text("story_fr").notNull(),
    storyEn: text("story_en").notNull(),
    visionFr: text("vision_fr").notNull(),
    visionEn: text("vision_en").notNull(),
    educationFr: text("education_fr").notNull(),
    educationEn: text("education_en").notNull(),
    missionFr: text("mission_fr").notNull(),
    missionEn: text("mission_en").notNull(),
    photoKey: varchar("photo_key", { length: 160 }),
    linkedinUrl: text("linkedin_url"),
    websiteUrl: text("website_url"),
    instagramUrl: text("instagram_url"),
    xUrl: text("x_url"),
    email: text("email"),
    isVisible: boolean("is_visible").default(true).notNull(),
    ...timestamps,
  },
);

export const landingSiteSettings = pgTable(
  "landing_site_settings",
  {
    id: serial("id").primaryKey(),
    supportEmail: text("support_email").notNull().default("support@sendflow.studio"),
    supportPhone: text("support_phone"),
    websiteUrl: text("website_url"),
    linkedinUrl: text("linkedin_url"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    companyName: text("company_name").notNull().default("Flow Digital SARL"),
    legalForm: text("legal_form").notNull().default("Société à responsabilité limitée"),
    legalAddress: text("legal_address").notNull().default("Côte d’Ivoire, Abidjan, Cocody Riviera Palmeraie"),
    legalEmail: text("legal_email").notNull().default("support@sendflow.studio"),
    footerAddressFlag: text("footer_address_flag").notNull().default("🇨🇮"),
    footerAddressCountry: text("footer_address_country").notNull().default("Côte d’Ivoire"),
    footerAddress: text("footer_address").notNull().default("Abidjan, Cocody Riviera Palmeraie"),
    regulatorNameFr: text("regulator_name_fr").notNull().default("Régulateur à confirmer"),
    regulatorNameEn: text("regulator_name_en").notNull().default("Regulator to be confirmed"),
    regulatorLogoKey: varchar("regulator_logo_key", { length: 160 }),
    googlePlayUrl: text("google_play_url"),
    appStoreUrl: text("app_store_url"),
    appGalleryUrl: text("app_gallery_url"),
    ...timestamps,
  },
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
    heroPositionX: integer("hero_position_x"),
    heroPositionY: integer("hero_position_y"),
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

export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    panelTokenHash: varchar("panel_token_hash", { length: 64 }),
    panelEmailHash: varchar("panel_email_hash", { length: 64 }),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    emailUnique: uniqueIndex("admin_users_email_unique").on(table.email),
  }),
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tokenUnique: uniqueIndex("admin_sessions_token_unique").on(table.tokenHash),
  }),
);