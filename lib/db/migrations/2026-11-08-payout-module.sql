-- LEGACY MIXED CANDIDATE — DO NOT APPLY.
-- This combines schema creation with existing-constraint replacements,
-- webhook/payment compatibility changes, and replacement payment guards.
-- Use 2026-11-08-payout-schema-additive.sql only for isolated schema rehearsal.
-- Any shared/production application requires an explicitly confirmed target,
-- separate review of the excluded changes, and approval of the rollout plan.
BEGIN;

ALTER TABLE public.sf_countries
  ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.sf_operator_catalog
  ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.sf_payment_limits
  ADD COLUMN IF NOT EXISTS maximum_payout_daily_minor bigint;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sf_payment_limits_daily_payout_check') THEN
    ALTER TABLE public.sf_payment_limits ADD CONSTRAINT sf_payment_limits_daily_payout_check
      CHECK (maximum_payout_daily_minor IS NULL OR
        maximum_payout_daily_minor BETWEEN minimum_payout_minor AND 9007199254740991);
  END IF;
END $$;

ALTER TABLE public.sf_operation_aggregator_routes
  DROP CONSTRAINT IF EXISTS sf_operation_aggregator_routes_operation_check;
ALTER TABLE public.sf_operation_aggregator_routes
  ADD CONSTRAINT sf_operation_aggregator_routes_operation_check
  CHECK (operation IN ('deposit','inter-network','international','payout'));

ALTER TABLE public.sf_developer_webhook_endpoints
  DROP CONSTRAINT IF EXISTS sf_developer_webhook_endpoints_events_check;
ALTER TABLE public.sf_developer_webhook_endpoints
  ADD CONSTRAINT sf_developer_webhook_endpoints_events_check CHECK (
    cardinality(events) BETWEEN 1 AND 7 AND events <@ ARRAY[
      'payment.succeeded','payment.failed','payout.created','payout.processing',
      'payout.succeeded','payout.failed','payout.uncertain'
    ]::text[]
  );

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
  CONSTRAINT sf_payout_requests_merchant_idempotency_uq UNIQUE(merchant_user_id,idempotency_key),
  CONSTRAINT sf_payout_requests_reference_format_check CHECK (reference ~ '^SFPO[A-F0-9]{16}$'),
  CONSTRAINT sf_payout_requests_idempotency_check CHECK (length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  CONSTRAINT sf_payout_requests_request_hash_check CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_requests_merchant_reference_check CHECK (
    merchant_reference IS NULL OR (length(btrim(merchant_reference)) BETWEEN 1 AND 128
      AND merchant_reference !~ '[[:cntrl:]]')
  ),
  CONSTRAINT sf_payout_requests_phone_cipher_check CHECK (
    beneficiary_phone_encrypted ~ '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT sf_payout_requests_phone_hash_check CHECK (beneficiary_phone_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_requests_name_cipher_check CHECK (
    beneficiary_name_encrypted IS NULL OR beneficiary_name_encrypted ~
      '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  ),
  CONSTRAINT sf_payout_requests_amount_check CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sf_payout_requests_currency_check CHECK (currency='XOF'),
  CONSTRAINT sf_payout_requests_fee_rate_check CHECK (fee_rate_units BETWEEN 0 AND 1000000),
  CONSTRAINT sf_payout_requests_fee_payer_check CHECK (fee_payer IN ('merchant','beneficiary')),
  CONSTRAINT sf_payout_requests_fee_check CHECK (fee_minor BETWEEN 0 AND 9007199254740991),
  CONSTRAINT sf_payout_requests_total_debit_check CHECK (total_debit_minor BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sf_payout_requests_beneficiary_amount_check CHECK (
    beneficiary_amount_minor BETWEEN 1 AND 9007199254740991
  ),
  CONSTRAINT sf_payout_requests_fee_math_check CHECK (
    (fee_payer='merchant' AND total_debit_minor=amount_minor+fee_minor
      AND beneficiary_amount_minor=amount_minor)
    OR
    (fee_payer='beneficiary' AND total_debit_minor=amount_minor
      AND beneficiary_amount_minor=amount_minor-fee_minor)
  ),
  CONSTRAINT sf_payout_requests_pricing_version_check CHECK (pricing_version>=1),
  CONSTRAINT sf_payout_requests_status_check CHECK (status IN (
    'created','validated','funds_reserved','submitted','processing','succeeded',
    'rejected','failed','uncertain','cancelled'
  )),
  CONSTRAINT sf_payout_requests_reservation_state_check CHECK (
    reservation_state IN ('none','active','consumed','released')
  ),
  CONSTRAINT sf_payout_requests_reservation_status_check CHECK (
    (reservation_state='none' AND status IN ('created','validated'))
    OR (reservation_state='active' AND status IN ('funds_reserved','submitted','processing','uncertain'))
    OR (reservation_state='consumed' AND status='succeeded')
    OR (reservation_state='released' AND status IN ('rejected','failed','cancelled'))
  ),
  CONSTRAINT sf_payout_requests_failure_code_check CHECK (
    failure_code IS NULL OR failure_code IN (
      'merchant_rejected','admin_rejected','execution_rejected','execution_failed',
      'insufficient_funds','daily_limit_exceeded','execution_unavailable'
    )
  ),
  CONSTRAINT sf_payout_requests_execution_reference_pair_check CHECK (
    (execution_reference_encrypted IS NULL AND execution_reference_hash IS NULL)
    OR (execution_reference_encrypted ~
      '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
      AND execution_reference_hash ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT sf_payout_requests_ledger_success_check CHECK (
    (status='succeeded' AND ledger_entry_id IS NOT NULL AND final_confirmation_id IS NOT NULL)
    OR (status<>'succeeded' AND ledger_entry_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS sf_payout_requests_merchant_reference_uq
  ON public.sf_payout_requests(merchant_user_id,merchant_reference)
  WHERE merchant_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sf_payout_requests_execution_reference_hash_uq
  ON public.sf_payout_requests(execution_reference_hash) WHERE execution_reference_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS sf_payout_requests_merchant_created_idx
  ON public.sf_payout_requests(merchant_user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS sf_payout_requests_status_created_idx
  ON public.sf_payout_requests(status,created_at);
CREATE INDEX IF NOT EXISTS sf_payout_requests_wallet_reservation_idx
  ON public.sf_payout_requests(wallet_id) WHERE reservation_state='active';

CREATE TABLE IF NOT EXISTS public.sf_payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid NOT NULL UNIQUE REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
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
  CONSTRAINT sf_payout_attempts_operation_reference_check CHECK (operation_reference ~ '^SFPO[A-F0-9]{16}$'),
  CONSTRAINT sf_payout_attempts_status_check CHECK (status IN ('prepared','dispatching','pending','uncertain','succeeded','failed')),
  CONSTRAINT sf_payout_attempts_expected_execution_account_hash_check CHECK (expected_execution_account_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_attempts_expected_execution_channel_check CHECK (length(btrim(expected_execution_channel_id)) BETWEEN 1 AND 80),
  CONSTRAINT sf_payout_attempts_execution_reference_pair_check CHECK (
    (execution_reference_encrypted IS NULL AND execution_reference_hash IS NULL)
    OR (execution_reference_encrypted ~
      '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
      AND execution_reference_hash ~ '^[a-f0-9]{64}$')
  )
);
CREATE INDEX IF NOT EXISTS sf_payout_attempts_status_idx
  ON public.sf_payout_attempts(status,updated_at);

CREATE TABLE IF NOT EXISTS public.sf_payout_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid NOT NULL UNIQUE REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL UNIQUE REFERENCES public.sf_payout_attempts(id) ON DELETE RESTRICT,
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
  CONSTRAINT sf_payout_confirmations_amount_check CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sf_payout_confirmations_currency_check CHECK (currency='XOF'),
  CONSTRAINT sf_payout_confirmations_execution_reference_hash_check CHECK (execution_reference_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_confirmations_execution_account_hash_check CHECK (execution_account_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_confirmations_execution_channel_check CHECK (length(btrim(execution_channel_id)) BETWEEN 1 AND 80),
  CONSTRAINT sf_payout_confirmations_operation_check CHECK (operation='payout'),
  CONSTRAINT sf_payout_confirmations_beneficiary_hash_check CHECK (beneficiary_phone_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sf_payout_confirmations_verification_passed_check CHECK (verification_passed=true),
  CONSTRAINT sf_payout_confirmations_execution_status_check CHECK (execution_status IN ('SUCCEEDED','FAILED')),
  CONSTRAINT sf_payout_confirmations_source_check CHECK (verification_source IN ('status_check','signed_event')),
  CONSTRAINT sf_payout_confirmations_evidence_cipher_check CHECK (
    evidence_encrypted ~ '^sfenc-v2\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
  )
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sf_payout_requests_final_confirmation_fk') THEN
    ALTER TABLE public.sf_payout_requests ADD CONSTRAINT sf_payout_requests_final_confirmation_fk
      FOREIGN KEY(final_confirmation_id) REFERENCES public.sf_payout_confirmations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sf_payout_attempts_final_confirmation_fk') THEN
    ALTER TABLE public.sf_payout_attempts ADD CONSTRAINT sf_payout_attempts_final_confirmation_fk
      FOREIGN KEY(final_confirmation_id) REFERENCES public.sf_payout_confirmations(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sf_payout_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id uuid NOT NULL REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
  from_status varchar(24),
  to_status varchar(24) NOT NULL,
  actor_type varchar(16) NOT NULL,
  actor_id varchar(255),
  reason_code varchar(48) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_payout_state_events_actor_check CHECK (actor_type IN ('merchant','admin','system')),
  CONSTRAINT sf_payout_state_events_reason_check CHECK (reason_code ~ '^[a-z0-9_:-]{1,48}$')
);
CREATE INDEX IF NOT EXISTS sf_payout_state_events_payout_created_idx
  ON public.sf_payout_state_events(payout_request_id,created_at,id);

ALTER TABLE public.sf_developer_webhook_deliveries
  ALTER COLUMN payment_session_id DROP NOT NULL;
ALTER TABLE public.sf_developer_webhook_deliveries
  DROP CONSTRAINT IF EXISTS sf_developer_webhook_deliveries_event_uq;
ALTER TABLE public.sf_developer_webhook_deliveries
  DROP CONSTRAINT IF EXISTS sf_developer_webhook_deliveries_event_check;
ALTER TABLE public.sf_developer_webhook_deliveries
  DROP CONSTRAINT IF EXISTS sf_developer_webhook_deliveries_entity_check;
ALTER TABLE public.sf_developer_webhook_deliveries
  ADD COLUMN IF NOT EXISTS payout_request_id uuid REFERENCES public.sf_payout_requests(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payout_state_event_id uuid REFERENCES public.sf_payout_state_events(id) ON DELETE RESTRICT;
ALTER TABLE public.sf_developer_webhook_deliveries
  ADD CONSTRAINT sf_developer_webhook_deliveries_event_check CHECK (event_type IN (
    'payment.succeeded','payment.failed','payout.created','payout.processing',
    'payout.succeeded','payout.failed','payout.uncertain'
  )),
  ADD CONSTRAINT sf_developer_webhook_deliveries_entity_check CHECK (
    (payment_session_id IS NOT NULL AND payout_request_id IS NULL AND payout_state_event_id IS NULL)
    OR
    (payment_session_id IS NULL AND payout_request_id IS NOT NULL AND payout_state_event_id IS NOT NULL)
  );
CREATE UNIQUE INDEX IF NOT EXISTS sf_developer_webhook_deliveries_payment_event_uq
  ON public.sf_developer_webhook_deliveries(endpoint_id,payment_session_id,event_type)
  WHERE payment_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sf_developer_webhook_deliveries_payout_event_uq
  ON public.sf_developer_webhook_deliveries(endpoint_id,payout_request_id,payout_state_event_id)
  WHERE payout_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sf_payouts_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout history is append-only';
END $$;

CREATE OR REPLACE FUNCTION public.sf_payouts_guard_request() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE wallet public.sf_wallets%ROWTYPE; account_status text; account_phone_verified boolean;
  held numeric; attempt public.sf_payout_attempts%ROWTYPE;
  proof public.sf_payout_confirmations%ROWTYPE; entry public.sf_wallet_ledger%ROWTYPE;
  operator_country text; country_enabled boolean; operator_enabled boolean;
  country_payout_enabled boolean; operator_payout_enabled boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'created' OR NEW.reservation_state<>'none'
       OR NEW.ledger_entry_id IS NOT NULL OR NEW.final_confirmation_id IS NOT NULL
       OR NEW.execution_reference_encrypted IS NOT NULL OR NEW.execution_reference_hash IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout must start in the created state';
    END IF;
    SELECT status::text,phone_verified_at IS NOT NULL INTO account_status,account_phone_verified
      FROM public.sf_users WHERE id=NEW.merchant_user_id FOR UPDATE;
    SELECT * INTO wallet FROM public.sf_wallets WHERE id=NEW.wallet_id FOR UPDATE;
    SELECT country_code,enabled,payout_enabled INTO operator_country,operator_enabled,operator_payout_enabled
      FROM public.sf_operator_catalog WHERE operator_id=NEW.operator_id;
    SELECT enabled,payout_enabled INTO country_enabled,country_payout_enabled
      FROM public.sf_countries WHERE country_code=NEW.country_code;
    IF account_status IS DISTINCT FROM 'active' OR account_phone_verified IS DISTINCT FROM true
      OR wallet.user_id<>NEW.merchant_user_id
      OR wallet.status::text<>'active' OR wallet.currency<>NEW.currency
      OR operator_country IS DISTINCT FROM NEW.country_code OR operator_enabled IS DISTINCT FROM true
      OR operator_payout_enabled IS DISTINCT FROM true
      OR country_enabled IS DISTINCT FROM true OR country_payout_enabled IS DISTINCT FROM true THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout owner, wallet or catalog eligibility mismatch';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','reservation_state','failure_code','execution_reference_encrypted',
      'execution_reference_hash','ledger_entry_id','final_confirmation_id','updated_at','reserved_at',
      'submitted_at','completed_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','reservation_state','failure_code','execution_reference_encrypted',
      'execution_reference_hash','ledger_entry_id','final_confirmation_id','updated_at','reserved_at',
      'submitted_at','completed_at']) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout financial snapshot is immutable';
  END IF;
  IF OLD.execution_reference_hash IS NOT NULL AND (
    NEW.execution_reference_hash IS DISTINCT FROM OLD.execution_reference_hash
    OR NEW.execution_reference_encrypted IS DISTINCT FROM OLD.execution_reference_encrypted
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout execution reference is immutable once recorded';
  END IF;
  IF OLD.status IN ('succeeded','rejected','failed','cancelled')
    OR (OLD.status='uncertain' AND NEW.status NOT IN ('uncertain','processing','succeeded','failed'))
    OR (OLD.status='created' AND NEW.status NOT IN ('created','validated','rejected','cancelled'))
    OR (OLD.status='validated' AND NEW.status NOT IN ('validated','funds_reserved','rejected','cancelled'))
    OR (OLD.status='funds_reserved' AND NEW.status NOT IN ('funds_reserved','submitted','rejected','cancelled','uncertain'))
    OR (OLD.status='submitted' AND NEW.status NOT IN ('submitted','processing','uncertain','succeeded','failed'))
    OR (OLD.status='processing' AND NEW.status NOT IN ('processing','uncertain','succeeded','failed'))
    OR (OLD.status='uncertain' AND NEW.status NOT IN ('uncertain','processing','succeeded','failed')) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid payout state transition';
  END IF;
  IF OLD.reservation_state IN ('consumed','released')
    AND NEW.reservation_state IS DISTINCT FROM OLD.reservation_state THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout reservation cannot be reopened';
  END IF;
  SELECT * INTO wallet FROM public.sf_wallets WHERE id=NEW.wallet_id FOR UPDATE;
  SELECT status::text,phone_verified_at IS NOT NULL INTO account_status,account_phone_verified
    FROM public.sf_users WHERE id=NEW.merchant_user_id FOR UPDATE;
  IF NEW.reservation_state='active' AND OLD.reservation_state='none' THEN
    IF NEW.status<>'funds_reserved' OR account_status<>'active'
      OR account_phone_verified IS DISTINCT FROM true OR wallet.status::text<>'active'
      OR wallet.currency<>NEW.currency THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout reservation requires an active account and wallet';
    END IF;
    UPDATE public.sf_wallets SET updated_at=clock_timestamp() WHERE id=wallet.id;
    SELECT
      coalesce((SELECT sum(amount_minor) FROM public.sf_wallet_payment_reservations
        WHERE wallet_id=wallet.id AND state='active'),0)
      + coalesce((SELECT sum(total_debit_minor) FROM public.sf_payout_requests
        WHERE wallet_id=wallet.id AND reservation_state='active' AND id<>NEW.id),0)
      INTO held;
    IF held+NEW.total_debit_minor>wallet.balance_minor THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Insufficient unreserved wallet funds';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IN ('submitted','processing','uncertain') THEN
    SELECT * INTO attempt FROM public.sf_payout_attempts WHERE payout_request_id=NEW.id;
    IF NOT FOUND OR attempt.dispatched_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout dispatch requires a persisted execution attempt';
    END IF;
  END IF;
  IF NEW.status IN ('rejected','cancelled') OR
    (NEW.status='failed' AND NEW.reservation_state='released' AND
      NOT EXISTS(SELECT 1 FROM public.sf_payout_attempts a WHERE a.payout_request_id=NEW.id AND a.dispatched_at IS NOT NULL)) THEN
    IF NEW.reservation_state<>'released' OR NEW.final_confirmation_id IS NOT NULL
      OR EXISTS(SELECT 1 FROM public.sf_payout_attempts a WHERE a.payout_request_id=NEW.id AND a.dispatched_at IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Only undispatched payouts can be released without final settlement evidence';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IN ('succeeded','failed') THEN
    SELECT * INTO attempt FROM public.sf_payout_attempts WHERE payout_request_id=NEW.id;
    SELECT * INTO proof FROM public.sf_payout_confirmations WHERE id=NEW.final_confirmation_id;
    IF attempt.id IS NULL OR proof.id IS NULL OR proof.payout_request_id<>NEW.id OR proof.attempt_id<>attempt.id
      OR proof.verification_passed IS NOT TRUE OR proof.operation<>'payout'
      OR proof.country_code<>NEW.country_code OR proof.operator_id<>NEW.operator_id
      OR proof.amount_minor<>NEW.beneficiary_amount_minor OR proof.currency<>NEW.currency
      OR proof.execution_reference_hash IS DISTINCT FROM attempt.execution_reference_hash
      OR proof.beneficiary_phone_hash IS DISTINCT FROM NEW.beneficiary_phone_hash
      OR proof.execution_account_hash IS DISTINCT FROM attempt.expected_execution_account_hash
      OR proof.execution_channel_id IS DISTINCT FROM attempt.expected_execution_channel_id
      OR NEW.execution_reference_hash IS DISTINCT FROM attempt.execution_reference_hash
      OR NEW.execution_reference_encrypted IS DISTINCT FROM attempt.execution_reference_encrypted THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout final state requires matching verified settlement evidence';
    END IF;
    IF NEW.status='succeeded' THEN
      SELECT * INTO entry FROM public.sf_wallet_ledger WHERE id=NEW.ledger_entry_id;
      IF NEW.reservation_state<>'consumed' OR proof.execution_status<>'SUCCEEDED'
        OR attempt.status<>'succeeded' OR attempt.final_confirmation_id<>proof.id
        OR entry.wallet_id<>NEW.wallet_id OR entry.user_id<>NEW.merchant_user_id
        OR entry.direction::text<>'debit' OR entry.currency<>NEW.currency
        OR entry.amount_minor<>NEW.total_debit_minor
        OR entry.idempotency_key<>'payout:'||NEW.id::text||':debit' THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Successful payout requires verified evidence and one matching debit';
      END IF;
    ELSIF NEW.reservation_state<>'released' OR proof.execution_status<>'FAILED'
      OR attempt.status<>'failed' OR attempt.final_confirmation_id<>proof.id
      OR NEW.ledger_entry_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Failed payout requires verified final failure and released reservation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sf_payouts_guard_attempt() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE payout public.sf_payout_requests%ROWTYPE; proof public.sf_payout_confirmations%ROWTYPE;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'prepared' OR NEW.dispatched_at IS NOT NULL
      OR NEW.execution_reference_hash IS NOT NULL OR NEW.execution_reference_encrypted IS NOT NULL
      OR NEW.final_confirmation_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout attempt must start prepared and undispatched';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','execution_reference_encrypted','execution_reference_hash',
      'final_confirmation_id','dispatched_at','updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','execution_reference_encrypted','execution_reference_hash',
      'final_confirmation_id','dispatched_at','updated_at'])
    OR (OLD.dispatched_at IS NOT NULL AND NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at)
    OR (OLD.execution_reference_hash IS NOT NULL AND (
      NEW.execution_reference_hash IS DISTINCT FROM OLD.execution_reference_hash
      OR NEW.execution_reference_encrypted IS DISTINCT FROM OLD.execution_reference_encrypted
    )) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout attempt identity is immutable';
  END IF;
  IF (OLD.status='prepared' AND NEW.status NOT IN ('prepared','dispatching'))
    OR (OLD.status='dispatching' AND NEW.status NOT IN ('dispatching','pending','uncertain'))
    OR (OLD.status='pending' AND NEW.status NOT IN ('pending','uncertain','succeeded','failed'))
    OR (OLD.status='uncertain' AND NEW.status NOT IN ('uncertain','pending','succeeded','failed'))
    OR (OLD.status IN ('succeeded','failed') AND NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid payout attempt transition';
  END IF;
  IF OLD.status='prepared' AND NEW.status='dispatching' THEN
    IF NEW.dispatched_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout dispatch time is required';
    END IF;
  END IF;
  IF NEW.status IN ('succeeded','failed') THEN
    SELECT * INTO proof FROM public.sf_payout_confirmations WHERE id=NEW.final_confirmation_id;
    SELECT * INTO payout FROM public.sf_payout_requests WHERE id=NEW.payout_request_id;
    IF proof.id IS NULL OR payout.id IS NULL OR proof.attempt_id<>NEW.id OR proof.payout_request_id<>payout.id
      OR proof.verification_passed IS NOT TRUE
      OR proof.execution_status<>(CASE WHEN NEW.status='succeeded' THEN 'SUCCEEDED' ELSE 'FAILED' END)
      OR proof.execution_reference_hash IS DISTINCT FROM NEW.execution_reference_hash
      OR proof.amount_minor<>payout.beneficiary_amount_minor
      OR proof.currency<>payout.currency
      OR proof.country_code<>payout.country_code
      OR proof.operator_id<>payout.operator_id
      OR proof.beneficiary_phone_hash IS DISTINCT FROM payout.beneficiary_phone_hash
      OR proof.execution_account_hash IS DISTINCT FROM NEW.expected_execution_account_hash
      OR proof.execution_channel_id IS DISTINCT FROM NEW.expected_execution_channel_id THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Final payout attempt requires matching verified settlement evidence';
    END IF;
  ELSIF NEW.final_confirmation_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Non-final payout attempt cannot bind final evidence';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sf_payouts_guard_confirmation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE payout public.sf_payout_requests%ROWTYPE; attempt public.sf_payout_attempts%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout confirmations are append-only';
  END IF;
  SELECT * INTO payout FROM public.sf_payout_requests WHERE id=NEW.payout_request_id;
  SELECT * INTO attempt FROM public.sf_payout_attempts WHERE id=NEW.attempt_id;
  IF payout.id IS NULL OR attempt.id IS NULL OR attempt.payout_request_id<>payout.id
    OR NEW.verification_passed IS NOT TRUE OR NEW.operation<>'payout'
    OR NEW.execution_reference_hash IS DISTINCT FROM attempt.execution_reference_hash
    OR NEW.amount_minor<>payout.beneficiary_amount_minor OR NEW.currency<>payout.currency
    OR NEW.country_code<>payout.country_code OR NEW.operator_id<>payout.operator_id
    OR NEW.beneficiary_phone_hash IS DISTINCT FROM payout.beneficiary_phone_hash
    OR NEW.execution_account_hash IS DISTINCT FROM attempt.expected_execution_account_hash
    OR NEW.execution_channel_id IS DISTINCT FROM attempt.expected_execution_channel_id THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Settlement evidence does not match the payout request';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sf_payouts_wallet_floor() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE held numeric;
BEGIN
  SELECT coalesce((SELECT sum(amount_minor) FROM public.sf_wallet_payment_reservations
      WHERE wallet_id=OLD.id AND state='active'),0)
    + coalesce((SELECT sum(total_debit_minor) FROM public.sf_payout_requests
      WHERE wallet_id=OLD.id AND reservation_state='active'),0)
    INTO held;
  IF held>0 AND (NEW.balance_minor<held OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Wallet funds are reserved for an unresolved payment or payout';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sf_payments_guard_reservation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE intent public.sf_payment_intents%ROWTYPE; parent public.sf_transactions%ROWTYPE;
  wallet public.sf_wallets%ROWTYPE; proof public.sf_payment_confirmations%ROWTYPE;
  leg public.sf_payment_attempts%ROWTYPE; entry public.sf_wallet_ledger%ROWTYPE;
  held numeric; account_status text;
BEGIN
  SELECT * INTO intent FROM public.sf_payment_intents WHERE id=NEW.intent_id;
  IF NOT FOUND OR intent.kind<>'international' OR intent.currency<>NEW.currency
    OR intent.sender_total_minor<>NEW.amount_minor THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid wallet reservation snapshot';
  END IF;
  SELECT * INTO parent FROM public.sf_transactions WHERE id=intent.transaction_id;
  SELECT status::text INTO account_status FROM public.sf_users WHERE id=parent.user_id FOR UPDATE;
  SELECT * INTO wallet FROM public.sf_wallets WHERE id=NEW.wallet_id FOR UPDATE;
  IF NOT FOUND OR wallet.user_id<>parent.user_id OR wallet.currency<>NEW.currency THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Wallet reservation ownership or currency mismatch';
  END IF;
  UPDATE public.sf_wallets SET updated_at=clock_timestamp() WHERE id=wallet.id;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'active' OR NEW.confirmation_id IS NOT NULL OR NEW.ledger_entry_id IS NOT NULL
      OR account_status<>'active' OR wallet.status::text<>'active'
      OR intent.state NOT IN ('created','paying') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reservation requires an active account and wallet';
    END IF;
    SELECT coalesce(sum(amount_minor),0)
      + coalesce((SELECT sum(total_debit_minor) FROM public.sf_payout_requests
        WHERE wallet_id=wallet.id AND reservation_state='active'),0)
      INTO held FROM public.sf_wallet_payment_reservations
      WHERE wallet_id=wallet.id AND state='active';
    IF held+NEW.amount_minor>wallet.balance_minor THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Insufficient unreserved wallet funds';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['state','confirmation_id','ledger_entry_id','updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','confirmation_id','ledger_entry_id','updated_at'])
    OR (OLD.state<>'active' AND to_jsonb(NEW)-'updated_at' IS DISTINCT FROM to_jsonb(OLD)-'updated_at')
    OR (OLD.state='active' AND NEW.state NOT IN ('active','consumed','released')) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reservation cannot be rewritten or reopened';
  END IF;
  IF NEW.state='active' THEN
    IF NEW.confirmation_id IS NOT NULL OR NEW.ledger_entry_id IS NOT NULL
      OR account_status<>'active' OR wallet.status::text<>'active' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Active reservation cannot be settled';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO leg FROM public.sf_payment_attempts WHERE intent_id=intent.id AND direction='payout';
  IF NEW.state='released' AND (NOT FOUND OR (leg.dispatched_at IS NULL AND leg.status IN ('prepared','failed'))) THEN
    IF NEW.confirmation_id IS NOT NULL OR NEW.ledger_entry_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Undispatched release cannot bind settlement evidence';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO proof FROM public.sf_payment_confirmations WHERE id=NEW.confirmation_id;
  IF NOT FOUND OR proof.attempt_id IS DISTINCT FROM leg.id OR leg.final_confirmation_id IS DISTINCT FROM proof.id
    OR leg.status<>(CASE WHEN NEW.state='consumed' THEN 'succeeded' ELSE 'failed' END)
  OR proof.provider_status<>leg.status THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Uncertain funds cannot be released or consumed';
  END IF;
  IF NEW.state='consumed' THEN
    SELECT * INTO entry FROM public.sf_wallet_ledger WHERE id=NEW.ledger_entry_id;
    IF NOT FOUND OR entry.wallet_id<>wallet.id OR entry.user_id<>wallet.user_id
      OR entry.direction::text<>'debit' OR entry.currency<>NEW.currency OR entry.amount_minor<>NEW.amount_minor
      OR entry.idempotency_key<>'payment:'||intent.id::text||':debit' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Consumed reservation requires its unique accounting debit';
    END IF;
  ELSIF NEW.ledger_entry_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Released reservation must not create a debit';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sf_payout_request_guard ON public.sf_payout_requests;
DROP TRIGGER IF EXISTS sf_payout_attempt_guard ON public.sf_payout_attempts;
DROP TRIGGER IF EXISTS sf_payout_confirmation_guard ON public.sf_payout_confirmations;
DROP TRIGGER IF EXISTS sf_payout_wallet_floor ON public.sf_wallets;
DROP TRIGGER IF EXISTS sf_payout_attempt_no_delete ON public.sf_payout_attempts;
DROP TRIGGER IF EXISTS sf_payout_confirmation_no_mutation ON public.sf_payout_confirmations;
DROP TRIGGER IF EXISTS sf_payout_event_no_mutation ON public.sf_payout_state_events;
DROP TRIGGER IF EXISTS sf_payout_attempt_no_truncate ON public.sf_payout_attempts;
DROP TRIGGER IF EXISTS sf_payout_confirmation_no_truncate ON public.sf_payout_confirmations;
DROP TRIGGER IF EXISTS sf_payout_event_no_truncate ON public.sf_payout_state_events;
DROP TRIGGER IF EXISTS sf_payout_request_no_delete ON public.sf_payout_requests;
DROP TRIGGER IF EXISTS sf_payout_request_no_truncate ON public.sf_payout_requests;
CREATE TRIGGER sf_payout_request_guard BEFORE INSERT OR UPDATE ON public.sf_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_guard_request();
CREATE TRIGGER sf_payout_attempt_guard BEFORE INSERT OR UPDATE ON public.sf_payout_attempts
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_guard_attempt();
CREATE TRIGGER sf_payout_confirmation_guard BEFORE INSERT ON public.sf_payout_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_guard_confirmation();
CREATE TRIGGER sf_payout_wallet_floor BEFORE UPDATE OF balance_minor,currency,user_id ON public.sf_wallets
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_wallet_floor();
CREATE TRIGGER sf_payout_attempt_no_delete BEFORE DELETE ON public.sf_payout_attempts
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();
CREATE TRIGGER sf_payout_confirmation_no_mutation BEFORE UPDATE OR DELETE ON public.sf_payout_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();
CREATE TRIGGER sf_payout_event_no_mutation BEFORE UPDATE OR DELETE ON public.sf_payout_state_events
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();
CREATE TRIGGER sf_payout_attempt_no_truncate BEFORE TRUNCATE ON public.sf_payout_attempts
  FOR EACH STATEMENT EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();
CREATE TRIGGER sf_payout_confirmation_no_truncate BEFORE TRUNCATE ON public.sf_payout_confirmations
  FOR EACH STATEMENT EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();
CREATE TRIGGER sf_payout_event_no_truncate BEFORE TRUNCATE ON public.sf_payout_state_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();
CREATE TRIGGER sf_payout_request_no_delete BEFORE DELETE ON public.sf_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();
CREATE TRIGGER sf_payout_request_no_truncate BEFORE TRUNCATE ON public.sf_payout_requests
  FOR EACH STATEMENT EXECUTE FUNCTION public.sf_payouts_reject_history_mutation();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sf_payout_requests','sf_payout_attempts','sf_payout_confirmations',
    'sf_payout_state_events'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
  END LOOP;
  REVOKE ALL ON FUNCTION public.sf_payouts_reject_history_mutation() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.sf_payouts_guard_request() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.sf_payouts_guard_attempt() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.sf_payouts_guard_confirmation() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.sf_payouts_wallet_floor() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.sf_payments_guard_reservation() FROM PUBLIC;
END $$;

COMMIT;
