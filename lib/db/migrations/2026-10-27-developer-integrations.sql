-- Additive developer API, hosted-checkout session and webhook infrastructure.
-- This migration does not create credentials, dispatch payments, or change
-- existing payment/ledger rows. Apply only through the reviewed Neon runner.

ALTER TABLE public.sf_customer_payment_links
  ADD COLUMN IF NOT EXISTS source varchar(12) NOT NULL DEFAULT 'linkflow';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.sf_customer_payment_links'::regclass
      AND conname='sf_customer_payment_links_source_check'
  ) THEN
    ALTER TABLE public.sf_customer_payment_links
      ADD CONSTRAINT sf_customer_payment_links_source_check
      CHECK (source IN ('linkflow','api'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sf_developer_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  label varchar(80) NOT NULL,
  public_key varchar(80) NOT NULL UNIQUE,
  public_key_prefix varchar(32) NOT NULL,
  public_key_hash varchar(64) NOT NULL UNIQUE,
  secret_key_prefix varchar(32) NOT NULL,
  secret_key_hash varchar(64) NOT NULL UNIQUE,
  status varchar(12) NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_developer_api_keys_status_check CHECK (status IN ('active','revoked')),
  CONSTRAINT sf_developer_api_keys_label_check CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  CONSTRAINT sf_developer_api_keys_public_prefix_check CHECK (public_key_prefix ~ '^sfpk_[A-Za-z0-9_-]{8,24}$'),
  CONSTRAINT sf_developer_api_keys_public_key_check CHECK (public_key ~ '^sfpk_live_[A-Za-z0-9_-]{43}$'),
  CONSTRAINT sf_developer_api_keys_public_hash_check CHECK (public_key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_developer_api_keys_secret_prefix_check CHECK (secret_key_prefix ~ '^sfsk_[A-Za-z0-9_-]{8,24}$'),
  CONSTRAINT sf_developer_api_keys_secret_hash_check CHECK (secret_key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_developer_api_keys_revoke_pair_check CHECK (
    (status='active' AND revoked_at IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS sf_developer_api_keys_owner_created_idx
  ON public.sf_developer_api_keys(user_id, created_at);

CREATE TABLE IF NOT EXISTS public.sf_developer_payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  api_key_id uuid NOT NULL REFERENCES public.sf_developer_api_keys(id) ON DELETE RESTRICT,
  payment_link_id uuid NOT NULL UNIQUE
    REFERENCES public.sf_customer_payment_links(id) ON DELETE RESTRICT,
  idempotency_key varchar(128) NOT NULL,
  merchant_reference varchar(128) NOT NULL,
  request_hash varchar(64) NOT NULL,
  client_token_hash varchar(64) NOT NULL UNIQUE,
  client_token_encrypted text NOT NULL,
  mode varchar(12) NOT NULL,
  amount_minor bigint NOT NULL,
  currency varchar(3) NOT NULL,
  metadata_encrypted text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_developer_payment_sessions_owner_idempotency_uq UNIQUE(user_id,idempotency_key),
  CONSTRAINT sf_developer_payment_sessions_owner_reference_uq UNIQUE(user_id,merchant_reference),
  CONSTRAINT sf_developer_payment_sessions_request_hash_check CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_developer_payment_sessions_client_token_hash_check CHECK (client_token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_developer_payment_sessions_client_token_cipher_check CHECK (
    client_token_encrypted ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT sf_developer_payment_sessions_mode_check CHECK (mode IN ('hosted','direct')),
  CONSTRAINT sf_developer_payment_sessions_amount_check CHECK (amount_minor BETWEEN 100 AND 2000000),
  CONSTRAINT sf_developer_payment_sessions_currency_check CHECK (currency='XOF'),
  CONSTRAINT sf_developer_payment_sessions_idempotency_check CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  CONSTRAINT sf_developer_payment_sessions_reference_check CHECK (length(btrim(merchant_reference)) BETWEEN 1 AND 128),
  CONSTRAINT sf_developer_payment_sessions_metadata_cipher_check CHECK (
    metadata_encrypted ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  )
);
CREATE INDEX IF NOT EXISTS sf_developer_payment_sessions_owner_created_idx
  ON public.sf_developer_payment_sessions(user_id,created_at,id);

CREATE TABLE IF NOT EXISTS public.sf_developer_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  label varchar(80) NOT NULL,
  url_encrypted text NOT NULL,
  events text[] NOT NULL,
  signing_secret_encrypted text NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_developer_webhook_endpoints_url_cipher_check CHECK (
    url_encrypted ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT sf_developer_webhook_endpoints_events_check CHECK (
    cardinality(events) BETWEEN 1 AND 2
    AND events <@ ARRAY['payment.succeeded','payment.failed']::text[]
  ),
  CONSTRAINT sf_developer_webhook_endpoints_secret_cipher_check CHECK (
    signing_secret_encrypted ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT sf_developer_webhook_endpoints_status_check CHECK (status IN ('active','revoked')),
  CONSTRAINT sf_developer_webhook_endpoints_revoke_pair_check CHECK (
    (status='active' AND revoked_at IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT sf_developer_webhook_endpoints_label_check CHECK (length(btrim(label)) BETWEEN 1 AND 80)
);
CREATE INDEX IF NOT EXISTS sf_developer_webhook_endpoints_owner_created_idx
  ON public.sf_developer_webhook_endpoints(user_id,created_at);

CREATE TABLE IF NOT EXISTS public.sf_developer_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL
    REFERENCES public.sf_developer_webhook_endpoints(id) ON DELETE RESTRICT,
  payment_session_id uuid NOT NULL
    REFERENCES public.sf_developer_payment_sessions(id) ON DELETE RESTRICT,
  event_type varchar(40) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  last_http_status varchar(3),
  last_error_class varchar(40),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_developer_webhook_deliveries_event_uq
    UNIQUE(endpoint_id,payment_session_id,event_type),
  CONSTRAINT sf_developer_webhook_deliveries_payload_check CHECK (octet_length(payload::text) <= 16384),
  CONSTRAINT sf_developer_webhook_deliveries_event_check CHECK (event_type IN ('payment.succeeded','payment.failed')),
  CONSTRAINT sf_developer_webhook_deliveries_status_check CHECK (status IN ('pending','delivering','delivered','failed')),
  CONSTRAINT sf_developer_webhook_deliveries_attempts_check CHECK (attempts BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS sf_developer_webhook_deliveries_due_idx
  ON public.sf_developer_webhook_deliveries(status,next_attempt_at,created_at);
