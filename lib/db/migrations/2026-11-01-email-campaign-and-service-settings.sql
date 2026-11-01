-- Additive schema migration for the SendFlow email campaign and customer
-- service settings modules. This migration creates tables and indexes only;
-- it does not alter or delete existing application data.

CREATE TABLE public.sf_email_campaigns (
  id text PRIMARY KEY,
  subject varchar(200) NOT NULL,
  body_text text NOT NULL,
  audience_mode varchar(16) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'draft',
  recipient_count integer NOT NULL DEFAULT 0,
  unverified_recipient_count integer NOT NULL DEFAULT 0,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT sf_email_campaigns_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  CONSTRAINT sf_email_campaign_subject_nonblank
    CHECK (length(btrim(subject)) > 0),
  CONSTRAINT sf_email_campaign_audience_check
    CHECK (audience_mode IN ('all', 'selected')),
  CONSTRAINT sf_email_campaign_status_check
    CHECK (status IN ('draft', 'queued', 'sending', 'completed', 'completed_with_errors', 'cancelled'))
);

CREATE INDEX sf_email_campaign_created_idx
  ON public.sf_email_campaigns (created_at);
CREATE INDEX sf_email_campaign_status_idx
  ON public.sf_email_campaigns (status, queued_at);

CREATE TABLE public.sf_email_campaign_recipients (
  id text PRIMARY KEY,
  campaign_id text NOT NULL,
  user_id text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft',
  attempts integer NOT NULL DEFAULT 0,
  manual_retries integer NOT NULL DEFAULT 0,
  email_snapshot_encrypted text,
  email_snapshot_lookup_hash varchar(64),
  provider_message_id varchar(255),
  provider_updated_at timestamptz,
  last_error_class varchar(32),
  last_error_status integer,
  next_attempt_at timestamptz,
  processing_started_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_email_campaign_recipients_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.sf_email_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT sf_email_campaign_recipients_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  CONSTRAINT sf_email_campaign_recipient_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT sf_email_campaign_recipient_manual_retries_check
    CHECK (manual_retries BETWEEN 0 AND 3),
  CONSTRAINT sf_email_campaign_recipient_status_check
    CHECK (status IN ('draft', 'queued', 'sending', 'accepted', 'delivered', 'bounced', 'complained', 'failed', 'cancelled'))
);

CREATE UNIQUE INDEX sf_email_campaign_recipient_uq
  ON public.sf_email_campaign_recipients (campaign_id, user_id);
CREATE INDEX sf_email_campaign_recipient_queue_idx
  ON public.sf_email_campaign_recipients (status, next_attempt_at, created_at);
CREATE INDEX sf_email_campaign_recipient_campaign_status_idx
  ON public.sf_email_campaign_recipients (campaign_id, status);

CREATE TABLE public.sf_email_campaign_attempts (
  id text PRIMARY KEY,
  recipient_id text NOT NULL,
  attempt_number integer NOT NULL,
  status varchar(16) NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  email_snapshot_encrypted text,
  email_snapshot_lookup_hash varchar(64),
  provider_message_id varchar(255),
  provider_updated_at timestamptz,
  error_class varchar(32),
  http_status integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_email_campaign_attempts_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES public.sf_email_campaign_recipients(id) ON DELETE CASCADE,
  CONSTRAINT sf_email_campaign_attempt_status_check
    CHECK (status IN ('sending', 'accepted', 'delivered', 'bounced', 'complained', 'failed')),
  CONSTRAINT sf_email_campaign_attempt_number_check
    CHECK (attempt_number > 0)
);

CREATE UNIQUE INDEX sf_email_campaign_attempt_recipient_number_uq
  ON public.sf_email_campaign_attempts (recipient_id, attempt_number);
CREATE INDEX sf_email_campaign_attempt_recipient_created_idx
  ON public.sf_email_campaign_attempts (recipient_id, created_at);
CREATE INDEX sf_email_campaign_attempt_idempotency_idx
  ON public.sf_email_campaign_attempts (idempotency_key);

CREATE TABLE public.sf_email_campaign_provider_events (
  provider_event_id varchar(255) PRIMARY KEY,
  recipient_id text NOT NULL,
  attempt_id text NOT NULL,
  provider_message_id varchar(255) NOT NULL,
  event_type varchar(32) NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT sf_email_campaign_provider_events_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES public.sf_email_campaign_recipients(id) ON DELETE CASCADE,
  CONSTRAINT sf_email_campaign_provider_events_attempt_id_fkey
    FOREIGN KEY (attempt_id) REFERENCES public.sf_email_campaign_attempts(id) ON DELETE CASCADE,
  CONSTRAINT sf_email_campaign_provider_event_type_check
    CHECK (event_type IN ('email.delivered', 'email.bounced', 'email.complained'))
);

CREATE INDEX sf_email_campaign_provider_event_attempt_idx
  ON public.sf_email_campaign_provider_events (attempt_id, occurred_at);
CREATE INDEX sf_email_campaign_provider_event_recipient_idx
  ON public.sf_email_campaign_provider_events (recipient_id, occurred_at);

CREATE TABLE public.sf_email_campaign_retry_requests (
  idempotency_key varchar(128) PRIMARY KEY,
  recipient_id text NOT NULL,
  admin_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_email_campaign_retry_requests_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES public.sf_email_campaign_recipients(id) ON DELETE CASCADE,
  CONSTRAINT sf_email_campaign_retry_requests_admin_user_id_fkey
    FOREIGN KEY (admin_user_id) REFERENCES public.sf_users(id) ON DELETE RESTRICT
);

CREATE INDEX sf_email_campaign_retry_recipient_created_idx
  ON public.sf_email_campaign_retry_requests (recipient_id, created_at);

CREATE TABLE public.sf_email_marketing_preference_events (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  action varchar(16) NOT NULL,
  source varchar(24) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_email_marketing_preference_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.sf_users(id) ON DELETE CASCADE
);

CREATE INDEX sf_email_marketing_preference_user_created_idx
  ON public.sf_email_marketing_preference_events (user_id, created_at);

CREATE TABLE public.sf_email_marketing_suppressions (
  email_lookup_hash varchar(64) PRIMARY KEY,
  reason varchar(16) NOT NULL,
  provider_event_id varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_email_marketing_suppression_reason_check
    CHECK (reason IN ('bounced', 'complained'))
);

CREATE INDEX sf_email_marketing_suppression_reason_idx
  ON public.sf_email_marketing_suppressions (reason, updated_at);

CREATE TABLE public.sf_customer_service_settings (
  id varchar(32) PRIMARY KEY,
  phone_number varchar(16),
  whatsapp_number varchar(16),
  facebook_label varchar(100),
  facebook_url varchar(500),
  version integer NOT NULL DEFAULT 1,
  updated_by varchar(255) NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_customer_service_settings_singleton_check
    CHECK (id = 'global'),
  CONSTRAINT sf_customer_service_settings_version_check
    CHECK (version > 0),
  CONSTRAINT sf_customer_service_settings_phone_check
    CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT sf_customer_service_settings_whatsapp_check
    CHECK (whatsapp_number IS NULL OR whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT sf_customer_service_settings_facebook_pair_check
    CHECK (
      (facebook_label IS NULL AND facebook_url IS NULL)
      OR (facebook_label IS NOT NULL AND facebook_url IS NOT NULL)
    )
);

-- The existing admin settings form updates this singleton row. Leave every
-- contact value empty so no phone number or social account is hard-coded.
INSERT INTO public.sf_customer_service_settings (id)
VALUES ('global');
