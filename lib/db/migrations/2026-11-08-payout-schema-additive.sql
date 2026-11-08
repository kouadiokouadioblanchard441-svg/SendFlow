-- Additive payout schema only. This draft is not authorized for any shared or
-- production database. Rehearse against an isolated PostgreSQL database and
-- confirm the exact target before applying it.
--
-- Deliberately excluded: changes to existing operation/webhook constraints,
-- payment_session_id nullability, payment reservation functions, wallet
-- triggers, payout execution triggers, and grants/revokes. See the paired
-- review note and the legacy combined candidate before any activation work.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.sf_countries
  ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.sf_operator_catalog
  ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.sf_payment_limits
  ADD COLUMN IF NOT EXISTS maximum_payout_daily_minor bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_payment_limits'::regclass
      AND conname = 'sf_payment_limits_daily_payout_check'
  ) THEN
    ALTER TABLE public.sf_payment_limits
      ADD CONSTRAINT sf_payment_limits_daily_payout_check
      CHECK (
        maximum_payout_daily_minor IS NULL
        OR maximum_payout_daily_minor BETWEEN minimum_payout_minor AND 9007199254740991
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sf_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(30) NOT NULL UNIQUE,
  merchant_user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  api_key_id uuid NOT NULL REFERENCES public.sf_developer_api_keys(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL REFERENCES public.sf_wallets(id) ON DELETE RESTRICT,
  idempotency_key varchar(128) NOT NULL,
  request_hash varchar(64) NOT NULL,
  merchant_reference varchar(128),
  country_code varchar(2) NOT NULL REFERENCES public.sf_countries(country_code) ON DELETE RESTRICT,
  operator_id varchar(60) NOT NULL REFERENCES public.sf_operator_catalog(operator_id) ON DELETE RESTRICT,
  beneficiary_phone_encrypted text NOT NULL,
  beneficiary_phone_hash varchar(64) NOT NULL,
  beneficiary_name_encrypted text,
  amount_minor bigint NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'XOF',
  fee_rate_units integer NOT NULL,
  fee_payer varchar(12) NOT NULL,
  fee_minor bigint NOT NULL,
  total_debit_minor bigint NOT NULL,
  beneficiary_amount_minor bigint NOT NULL,
  pricing_version integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'created',
  reservation_state varchar(12) NOT NULL DEFAULT 'none',
  failure_code varchar(48),
  execution_reference_encrypted text,
  execution_reference_hash varchar(64),
  ledger_entry_id uuid UNIQUE REFERENCES public.sf_wallet_ledger(id) ON DELETE RESTRICT,
  final_confirmation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reserved_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT sf_payout_requests_merchant_idempotency_uq
    UNIQUE(merchant_user_id, idempotency_key),
  CONSTRAINT sf_payout_requests_reference_format_check
    CHECK (reference ~ '^SFPO[A-F0-9]{16}$'),
  CONSTRAINT sf_payout_requests_idempotency_check
    CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  CONSTRAINT sf_payout_requests_request_hash_check
    CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_requests_merchant_reference_check
    CHECK (merchant_reference IS NULL OR (
      length(btrim(merchant_reference)) BETWEEN 1 AND 128
      AND merchant_reference !~ '[[:cntrl:]]'
    )),
  CONSTRAINT sf_payout_requests_phone_cipher_check
    CHECK (beneficiary_phone_encrypted ~
      '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
  CONSTRAINT sf_payout_requests_phone_hash_check
    CHECK (beneficiary_phone_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_requests_name_cipher_check
    CHECK (beneficiary_name_encrypted IS NULL OR beneficiary_name_encrypted ~
      '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
  CONSTRAINT sf_payout_requests_amount_check
    CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sf_payout_requests_currency_check CHECK (currency = 'XOF'),
  CONSTRAINT sf_payout_requests_fee_rate_check
    CHECK (fee_rate_units BETWEEN 0 AND 1000000),
  CONSTRAINT sf_payout_requests_fee_payer_check
    CHECK (fee_payer IN ('merchant', 'beneficiary')),
  CONSTRAINT sf_payout_requests_fee_check
    CHECK (fee_minor BETWEEN 0 AND 9007199254740991),
  CONSTRAINT sf_payout_requests_total_debit_check
    CHECK (total_debit_minor BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sf_payout_requests_beneficiary_amount_check
    CHECK (beneficiary_amount_minor BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sf_payout_requests_fee_math_check CHECK (
    (fee_payer = 'merchant'
      AND total_debit_minor = amount_minor + fee_minor
      AND beneficiary_amount_minor = amount_minor)
    OR
    (fee_payer = 'beneficiary'
      AND total_debit_minor = amount_minor
      AND beneficiary_amount_minor = amount_minor - fee_minor)
  ),
  CONSTRAINT sf_payout_requests_pricing_version_check CHECK (pricing_version >= 1),
  CONSTRAINT sf_payout_requests_status_check CHECK (status IN (
    'created', 'validated', 'funds_reserved', 'submitted', 'processing',
    'succeeded', 'rejected', 'failed', 'uncertain', 'cancelled'
  )),
  CONSTRAINT sf_payout_requests_reservation_state_check
    CHECK (reservation_state IN ('none', 'active', 'consumed', 'released')),
  CONSTRAINT sf_payout_requests_reservation_status_check CHECK (
    (reservation_state = 'none' AND status IN ('created', 'validated'))
    OR (reservation_state = 'active'
      AND status IN ('funds_reserved', 'submitted', 'processing', 'uncertain'))
    OR (reservation_state = 'consumed' AND status = 'succeeded')
    OR (reservation_state = 'released' AND status IN ('rejected', 'failed', 'cancelled'))
  ),
  CONSTRAINT sf_payout_requests_failure_code_check CHECK (failure_code IS NULL OR failure_code IN (
    'merchant_rejected', 'admin_rejected', 'execution_rejected', 'execution_failed',
    'insufficient_funds', 'daily_limit_exceeded', 'execution_unavailable'
  )),
  CONSTRAINT sf_payout_requests_execution_reference_pair_check CHECK (
    (execution_reference_encrypted IS NULL AND execution_reference_hash IS NULL)
    OR (execution_reference_encrypted ~
      '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
      AND execution_reference_hash ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT sf_payout_requests_ledger_success_check CHECK (
    (status = 'succeeded' AND ledger_entry_id IS NOT NULL AND final_confirmation_id IS NOT NULL)
    OR (status <> 'succeeded' AND ledger_entry_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_payout_requests_merchant_reference_uq
  ON public.sf_payout_requests(merchant_user_id, merchant_reference)
  WHERE merchant_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sf_payout_requests_execution_reference_hash_uq
  ON public.sf_payout_requests(execution_reference_hash)
  WHERE execution_reference_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_payout_requests_merchant_created_idx
  ON public.sf_payout_requests(merchant_user_id, created_at, id);
CREATE INDEX IF NOT EXISTS sf_payout_requests_status_created_idx
  ON public.sf_payout_requests(status, created_at);
CREATE INDEX IF NOT EXISTS sf_payout_requests_wallet_reservation_idx
  ON public.sf_payout_requests(wallet_id)
  WHERE reservation_state = 'active';

CREATE TABLE IF NOT EXISTS public.sf_payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid NOT NULL UNIQUE
    REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
  operation_reference varchar(30) NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'prepared',
  expected_execution_account_hash varchar(64) NOT NULL,
  expected_execution_channel_id varchar(80) NOT NULL,
  execution_reference_encrypted text,
  execution_reference_hash varchar(64),
  final_confirmation_id uuid,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_payout_attempts_operation_reference_check
    CHECK (operation_reference ~ '^SFPO[A-F0-9]{16}$'),
  CONSTRAINT sf_payout_attempts_status_check
    CHECK (status IN ('prepared', 'dispatching', 'pending', 'uncertain', 'succeeded', 'failed')),
  CONSTRAINT sf_payout_attempts_expected_execution_account_hash_check
    CHECK (expected_execution_account_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_attempts_expected_execution_channel_check
    CHECK (length(btrim(expected_execution_channel_id)) BETWEEN 1 AND 80),
  CONSTRAINT sf_payout_attempts_execution_reference_pair_check CHECK (
    (execution_reference_encrypted IS NULL AND execution_reference_hash IS NULL)
    OR (execution_reference_encrypted ~
      '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
      AND execution_reference_hash ~ '^[a-f0-9]{64}$')
  )
);
CREATE INDEX IF NOT EXISTS sf_payout_attempts_status_idx
  ON public.sf_payout_attempts(status, updated_at);

CREATE TABLE IF NOT EXISTS public.sf_payout_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid NOT NULL
    REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL UNIQUE
    REFERENCES public.sf_payout_attempts(id) ON DELETE RESTRICT,
  verification_source varchar(24) NOT NULL,
  execution_status varchar(16) NOT NULL,
  execution_reference_hash varchar(64) NOT NULL,
  amount_minor bigint NOT NULL,
  currency varchar(3) NOT NULL,
  execution_account_hash varchar(64) NOT NULL,
  execution_channel_id varchar(80) NOT NULL,
  operation varchar(8) NOT NULL DEFAULT 'payout',
  country_code varchar(2) NOT NULL,
  operator_id varchar(60) NOT NULL,
  beneficiary_phone_hash varchar(64) NOT NULL,
  verification_passed boolean NOT NULL DEFAULT false,
  evidence_encrypted text NOT NULL,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_payout_confirmations_request_uq UNIQUE (payout_request_id),
  CONSTRAINT sf_payout_confirmations_amount_check
    CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sf_payout_confirmations_currency_check CHECK (currency = 'XOF'),
  CONSTRAINT sf_payout_confirmations_execution_reference_hash_check
    CHECK (execution_reference_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_confirmations_execution_account_hash_check
    CHECK (execution_account_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_confirmations_execution_channel_check
    CHECK (length(btrim(execution_channel_id)) BETWEEN 1 AND 80),
  CONSTRAINT sf_payout_confirmations_operation_check CHECK (operation = 'payout'),
  CONSTRAINT sf_payout_confirmations_beneficiary_hash_check
    CHECK (beneficiary_phone_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_confirmations_verification_check CHECK (verification_passed = true),
  CONSTRAINT sf_payout_confirmations_execution_status_check
    CHECK (execution_status IN ('SUCCEEDED', 'FAILED')),
  CONSTRAINT sf_payout_confirmations_source_check
    CHECK (verification_source IN ('status_check', 'signed_event')),
  CONSTRAINT sf_payout_confirmations_evidence_cipher_check CHECK (evidence_encrypted ~
    '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_payout_requests'::regclass
      AND conname = 'sf_payout_requests_final_confirmation_fk'
  ) THEN
    ALTER TABLE public.sf_payout_requests
      ADD CONSTRAINT sf_payout_requests_final_confirmation_fk
      FOREIGN KEY (final_confirmation_id)
      REFERENCES public.sf_payout_confirmations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sf_payout_attempts'::regclass
      AND conname = 'sf_payout_attempts_final_confirmation_fk'
  ) THEN
    ALTER TABLE public.sf_payout_attempts
      ADD CONSTRAINT sf_payout_attempts_final_confirmation_fk
      FOREIGN KEY (final_confirmation_id)
      REFERENCES public.sf_payout_confirmations(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sf_payout_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid NOT NULL
    REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
  from_status varchar(24),
  to_status varchar(24) NOT NULL,
  actor_type varchar(16) NOT NULL,
  actor_id varchar(255),
  reason_code varchar(48) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_payout_state_events_actor_check
    CHECK (actor_type IN ('merchant', 'admin', 'system')),
  CONSTRAINT sf_payout_state_events_reason_check
    CHECK (reason_code ~ '^[a-z0-9_:-]{1,48}$')
);
CREATE INDEX IF NOT EXISTS sf_payout_state_events_payout_created_idx
  ON public.sf_payout_state_events(payout_request_id, created_at, id);

ALTER TABLE public.sf_developer_webhook_deliveries
  ADD COLUMN IF NOT EXISTS payout_request_id uuid
    REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payout_state_event_id uuid
    REFERENCES public.sf_payout_state_events(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS sf_developer_webhook_deliveries_payout_event_uq
  ON public.sf_developer_webhook_deliveries(endpoint_id, payout_request_id, payout_state_event_id)
  WHERE payout_request_id IS NOT NULL;

COMMIT;
