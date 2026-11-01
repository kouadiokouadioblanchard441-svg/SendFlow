CREATE TABLE "sf_customer_service_settings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"phone_number" varchar(16),
	"whatsapp_number" varchar(16),
	"facebook_label" varchar(100),
	"facebook_url" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" varchar(255) DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_customer_service_settings_singleton_check" CHECK ("sf_customer_service_settings"."id" = 'global'),
	CONSTRAINT "sf_customer_service_settings_version_check" CHECK ("sf_customer_service_settings"."version" > 0),
	CONSTRAINT "sf_customer_service_settings_phone_check" CHECK ("sf_customer_service_settings"."phone_number" is null or "sf_customer_service_settings"."phone_number" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "sf_customer_service_settings_whatsapp_check" CHECK ("sf_customer_service_settings"."whatsapp_number" is null or "sf_customer_service_settings"."whatsapp_number" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "sf_customer_service_settings_facebook_pair_check" CHECK (("sf_customer_service_settings"."facebook_label" is null and "sf_customer_service_settings"."facebook_url" is null) or ("sf_customer_service_settings"."facebook_label" is not null and "sf_customer_service_settings"."facebook_url" is not null))
);
--> statement-breakpoint
INSERT INTO "sf_customer_service_settings" ("id", "phone_number", "whatsapp_number", "facebook_label", "facebook_url")
VALUES ('global', NULL, NULL, NULL, NULL)
ON CONFLICT ("id") DO NOTHING;
