-- Add provider delivery tracking and hashed-address campaign suppression.
-- Existing campaign, attempt, retry, and marketing-preference data is preserved.

ALTER TABLE "sf_email_campaign_recipients"
  ADD COLUMN IF NOT EXISTS "email_snapshot_lookup_hash" varchar(64),
  ADD COLUMN IF NOT EXISTS "provider_updated_at" timestamptz;

ALTER TABLE "sf_email_campaign_recipients"
  DROP CONSTRAINT IF EXISTS "sf_email_campaign_recipient_status_check";
ALTER TABLE "sf_email_campaign_recipients"
  ADD CONSTRAINT "sf_email_campaign_recipient_status_check"
  CHECK ("status" IN ('draft', 'queued', 'sending', 'accepted', 'delivered', 'bounced', 'complained', 'failed', 'cancelled'));

ALTER TABLE "sf_email_campaign_attempts"
  ADD COLUMN IF NOT EXISTS "email_snapshot_lookup_hash" varchar(64),
  ADD COLUMN IF NOT EXISTS "provider_updated_at" timestamptz;

ALTER TABLE "sf_email_campaign_attempts"
  DROP CONSTRAINT IF EXISTS "sf_email_campaign_attempt_status_check";
ALTER TABLE "sf_email_campaign_attempts"
  ADD CONSTRAINT "sf_email_campaign_attempt_status_check"
  CHECK ("status" IN ('sending', 'accepted', 'delivered', 'bounced', 'complained', 'failed'));

CREATE TABLE IF NOT EXISTS "sf_email_campaign_provider_events" (
  "provider_event_id" varchar(255) PRIMARY KEY NOT NULL,
  "recipient_id" text NOT NULL REFERENCES "sf_email_campaign_recipients"("id") ON DELETE CASCADE,
  "attempt_id" text NOT NULL REFERENCES "sf_email_campaign_attempts"("id") ON DELETE CASCADE,
  "provider_message_id" varchar(255) NOT NULL,
  "event_type" varchar(32) NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz,
  CONSTRAINT "sf_email_campaign_provider_event_type_check"
    CHECK ("event_type" IN ('email.delivered', 'email.bounced', 'email.complained'))
);

CREATE TABLE IF NOT EXISTS "sf_email_marketing_suppressions" (
  "email_lookup_hash" varchar(64) PRIMARY KEY NOT NULL,
  "reason" varchar(16) NOT NULL,
  "provider_event_id" varchar(255) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sf_email_marketing_suppression_reason_check"
    CHECK ("reason" IN ('bounced', 'complained'))
);

CREATE INDEX IF NOT EXISTS "sf_email_campaign_provider_event_attempt_idx"
  ON "sf_email_campaign_provider_events" ("attempt_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "sf_email_campaign_provider_event_recipient_idx"
  ON "sf_email_campaign_provider_events" ("recipient_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "sf_email_marketing_suppression_reason_idx"
  ON "sf_email_marketing_suppressions" ("reason", "updated_at");
