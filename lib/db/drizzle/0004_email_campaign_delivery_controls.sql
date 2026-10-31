ALTER TABLE "sf_users"
  ADD COLUMN IF NOT EXISTS "email_marketing_consent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "email_marketing_unsubscribed_at" timestamptz;

ALTER TABLE "sf_email_campaign_recipients"
  ADD COLUMN IF NOT EXISTS "manual_retries" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "email_snapshot_encrypted" text;

ALTER TABLE "sf_email_campaign_recipients"
  ADD CONSTRAINT "sf_email_campaign_recipient_manual_retries_check"
  CHECK ("manual_retries" BETWEEN 0 AND 3);

CREATE TABLE IF NOT EXISTS "sf_email_campaign_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient_id" text NOT NULL REFERENCES "sf_email_campaign_recipients"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "status" varchar(16) NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "provider_message_id" varchar(255),
  "error_class" varchar(32),
  "http_status" integer,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sf_email_campaign_attempt_status_check"
    CHECK ("status" IN ('sending', 'accepted', 'failed')),
  CONSTRAINT "sf_email_campaign_attempt_number_check"
    CHECK ("attempt_number" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "sf_email_campaign_attempt_recipient_number_uq"
  ON "sf_email_campaign_attempts" ("recipient_id", "attempt_number");
CREATE INDEX IF NOT EXISTS "sf_email_campaign_attempt_recipient_created_idx"
  ON "sf_email_campaign_attempts" ("recipient_id", "created_at");
CREATE INDEX IF NOT EXISTS "sf_email_campaign_attempt_idempotency_idx"
  ON "sf_email_campaign_attempts" ("idempotency_key");

CREATE TABLE IF NOT EXISTS "sf_email_campaign_retry_requests" (
  "idempotency_key" varchar(128) PRIMARY KEY NOT NULL,
  "recipient_id" text NOT NULL REFERENCES "sf_email_campaign_recipients"("id") ON DELETE CASCADE,
  "admin_user_id" text NOT NULL REFERENCES "sf_users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "sf_email_campaign_retry_recipient_created_idx"
  ON "sf_email_campaign_retry_requests" ("recipient_id", "created_at");

CREATE TABLE IF NOT EXISTS "sf_email_marketing_preference_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "sf_users"("id") ON DELETE CASCADE,
  "action" varchar(16) NOT NULL CHECK ("action" IN ('opted_in', 'opted_out', 'unsubscribed')),
  "source" varchar(24) NOT NULL CHECK ("source" IN ('account_settings', 'email_link')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "sf_email_marketing_preference_user_created_idx"
  ON "sf_email_marketing_preference_events" ("user_id", "created_at");
