-- Scoped, additive financial infrastructure. Run only through the reviewed
-- payment-structure migration runner, never at application startup.
-- No existing user, transaction, wallet, country or pricing row is modified.
CREATE TABLE public.sf_payment_schema_versions (
  migration_id text PRIMARY KEY,
  checksum varchar(64) NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  schema_fingerprint varchar(64) NOT NULL CHECK (schema_fingerprint ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.sf_transactions(id) ON DELETE RESTRICT,
  provider_code varchar(60) NOT NULL REFERENCES public.sf_payment_aggregators(code) ON DELETE RESTRICT,
  request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  kind varchar(24) NOT NULL CHECK (kind IN ('deposit','inter-network','international')),
  currency varchar(3) NOT NULL CHECK (currency IN ('XOF','XAF')),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  fee_minor bigint NOT NULL CHECK (fee_minor BETWEEN 0 AND 9007199254740991),
  fee_payer varchar(12) NOT NULL CHECK (fee_payer IN ('sender','recipient')),
  sender_total_minor bigint NOT NULL CHECK (sender_total_minor BETWEEN 1 AND 9007199254740991),
  recipient_total_minor bigint NOT NULL CHECK (recipient_total_minor BETWEEN 1 AND 9007199254740991),
  state varchar(32) NOT NULL DEFAULT 'created'
    CHECK (state IN ('created','collecting','funded','paying','succeeded','failed','uncertain','refund_due')),
  ledger_entry_id uuid UNIQUE REFERENCES public.sf_wallet_ledger(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_payment_intent_fee_math CHECK (
    (fee_payer='sender' AND sender_total_minor=amount_minor+fee_minor AND recipient_total_minor=amount_minor)
    OR (fee_payer='recipient' AND sender_total_minor=amount_minor AND recipient_total_minor=amount_minor-fee_minor)
  )
);
CREATE INDEX sf_payment_intents_state_idx ON public.sf_payment_intents(state,created_at);

CREATE TABLE public.sf_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES public.sf_payment_intents(id) ON DELETE RESTRICT,
  direction varchar(12) NOT NULL CHECK (direction IN ('payin','payout')),
  country_code varchar(2) NOT NULL REFERENCES public.sf_countries(country_code) ON DELETE RESTRICT,
  channel_id varchar(80) NOT NULL CHECK (length(channel_id)>0),
  operation_reference varchar(30) NOT NULL UNIQUE CHECK (operation_reference ~ '^[A-Z0-9]{12,30}$'),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency varchar(3) NOT NULL CHECK (currency IN ('XOF','XAF')),
  status varchar(20) NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared','dispatching','pending','uncertain','succeeded','failed')),
  provider_reference text,
  provider_reference_hash varchar(64) UNIQUE,
  final_confirmation_id uuid,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_payment_attempt_leg_unique UNIQUE(intent_id,direction),
  CONSTRAINT sf_payment_attempt_reference_pair CHECK (
    (provider_reference IS NULL AND provider_reference_hash IS NULL)
    OR (provider_reference IS NOT NULL AND provider_reference_hash IS NOT NULL
        AND provider_reference ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
        AND octet_length(provider_reference)<=4096 AND provider_reference_hash ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT sf_payment_attempt_confirmable_reference CHECK (
    status NOT IN ('pending','succeeded') OR provider_reference_hash IS NOT NULL
  )
);
CREATE INDEX sf_payment_attempts_reconcile_idx ON public.sf_payment_attempts(status,updated_at);

CREATE TABLE public.sf_payment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.sf_payment_attempts(id) ON DELETE RESTRICT,
  event_fingerprint varchar(64) NOT NULL UNIQUE CHECK (event_fingerprint ~ '^[a-f0-9]{64}$'),
  source varchar(24) NOT NULL CHECK (source IN ('provider_status','verified_webhook')),
  provider_status varchar(12) NOT NULL CHECK (provider_status IN ('pending','succeeded','failed')),
  provider_reference_hash varchar(64) NOT NULL CHECK (provider_reference_hash ~ '^[a-f0-9]{64}$'),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency varchar(3) NOT NULL CHECK (currency IN ('XOF','XAF')),
  encrypted_payload text NOT NULL CHECK (
    encrypted_payload ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'
    AND octet_length(encrypted_payload)<=131072
  ),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sf_payment_attempts ADD CONSTRAINT sf_payment_attempt_confirmation_fk
  FOREIGN KEY(final_confirmation_id) REFERENCES public.sf_payment_confirmations(id) ON DELETE RESTRICT;

CREATE TABLE public.sf_wallet_payment_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL UNIQUE REFERENCES public.sf_payment_intents(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL REFERENCES public.sf_wallets(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency varchar(3) NOT NULL CHECK (currency IN ('XOF','XAF')),
  state varchar(12) NOT NULL DEFAULT 'active' CHECK (state IN ('active','consumed','released')),
  confirmation_id uuid REFERENCES public.sf_payment_confirmations(id) ON DELETE RESTRICT,
  ledger_entry_id uuid UNIQUE REFERENCES public.sf_wallet_ledger(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sf_wallet_payment_reservations_active_idx
  ON public.sf_wallet_payment_reservations(wallet_id) WHERE state='active';

CREATE FUNCTION public.sf_payments_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment financial history is append-only';
END $$;

CREATE FUNCTION public.sf_payments_guard_intent() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent public.sf_transactions%ROWTYPE; entry public.sf_wallet_ledger%ROWTYPE;
  leg public.sf_payment_attempts%ROWTYPE; held public.sf_wallet_payment_reservations%ROWTYPE;
BEGIN
  SELECT * INTO parent FROM public.sf_transactions WHERE id=NEW.transaction_id FOR UPDATE;
  IF NOT FOUND OR parent.kind::text<>NEW.kind OR parent.currency<>NEW.currency
    OR parent.amount_minor<>NEW.amount_minor OR parent.fee_minor<>NEW.fee_minor THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment snapshot does not match its transaction';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'created' OR NEW.ledger_entry_id IS NOT NULL OR parent.status::text<>'pending'
      OR parent.provider_reference IS NOT NULL OR parent.provider_reference_lookup_hash IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment must start in created state';
    END IF;
    -- Also version the parent row so a concurrent REPEATABLE READ writer cannot
    -- miss the creation of this immutable financial snapshot.
    UPDATE public.sf_transactions SET updated_at=clock_timestamp() WHERE id=parent.id;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['state','ledger_entry_id','updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','ledger_entry_id','updated_at'])
    OR (OLD.ledger_entry_id IS NOT NULL AND NEW.ledger_entry_id IS DISTINCT FROM OLD.ledger_entry_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment snapshot is immutable';
  END IF;
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='created' AND NEW.state IN ('collecting','paying','failed'))
    OR (OLD.state='collecting' AND NEW.state IN ('funded','succeeded','failed','uncertain'))
    OR (OLD.state='funded' AND NEW.state IN ('paying','refund_due','uncertain'))
    OR (OLD.state='paying' AND NEW.state IN ('succeeded','failed','refund_due','uncertain'))
    OR (OLD.state='uncertain' AND NEW.state IN ('collecting','funded','paying','succeeded','failed','refund_due'))
    OR (OLD.state='refund_due' AND NEW.state='uncertain')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid payment state transition';
  END IF;
  IF (NEW.state='collecting' AND NEW.kind='international')
    OR (NEW.state='paying' AND NEW.kind='deposit')
    OR (NEW.state IN ('funded','refund_due') AND NEW.kind<>'inter-network') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment state is incompatible with its kind';
  END IF;
  IF NEW.state IN ('funded','refund_due') OR (NEW.state='paying' AND NEW.kind='inter-network') THEN
    IF NOT EXISTS(SELECT 1 FROM public.sf_payment_attempts
      WHERE intent_id=NEW.id AND direction='payin' AND status='succeeded') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Collection must be confirmed before disbursement';
    END IF;
  END IF;
  IF NEW.state='failed' AND EXISTS(SELECT 1 FROM public.sf_payment_attempts
    WHERE intent_id=NEW.id AND (status IN ('dispatching','pending','uncertain','succeeded'))) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Unresolved or funded payment cannot be marked failed';
  END IF;
  IF NEW.state='failed' AND EXISTS(SELECT 1 FROM public.sf_wallet_payment_reservations
    WHERE intent_id=NEW.id AND state='active') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Active funds must not be orphaned by a failed payment';
  END IF;
  IF NEW.state='paying' AND NEW.kind='international' AND NOT EXISTS(
    SELECT 1 FROM public.sf_wallet_payment_reservations WHERE intent_id=NEW.id AND state='active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='International payment requires reserved wallet funds';
  END IF;
  IF NEW.state='refund_due' AND EXISTS(SELECT 1 FROM public.sf_payment_attempts
    WHERE intent_id=NEW.id AND direction='payout' AND status NOT IN ('prepared','failed')) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Unresolved disbursement cannot authorize a refund';
  END IF;
  IF NEW.state='succeeded' THEN
    SELECT * INTO leg FROM public.sf_payment_attempts WHERE intent_id=NEW.id
      AND direction=CASE WHEN NEW.kind='deposit' THEN 'payin' ELSE 'payout' END;
    IF NOT FOUND OR leg.status<>'succeeded' OR leg.final_confirmation_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment success requires verified provider confirmation';
    END IF;
    IF NEW.kind='inter-network' THEN
      IF NEW.ledger_entry_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Inter-network payments do not debit a SendFlow wallet';
      END IF;
    ELSE
      SELECT * INTO entry FROM public.sf_wallet_ledger WHERE id=NEW.ledger_entry_id;
      IF NOT FOUND OR entry.user_id<>parent.user_id OR entry.currency<>NEW.currency
        OR entry.direction::text<>(CASE WHEN NEW.kind='deposit' THEN 'credit' ELSE 'debit' END)
        OR entry.amount_minor<>(CASE WHEN NEW.kind='deposit' THEN NEW.recipient_total_minor ELSE NEW.sender_total_minor END)
        OR entry.idempotency_key<>'payment:'||NEW.id::text||(CASE WHEN NEW.kind='deposit' THEN ':credit' ELSE ':debit' END)
        OR NOT EXISTS(SELECT 1 FROM public.sf_wallets WHERE id=entry.wallet_id
          AND user_id=parent.user_id AND currency=NEW.currency) THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment accounting entry is missing or incompatible';
      END IF;
      IF NEW.kind='international' THEN
        SELECT * INTO held FROM public.sf_wallet_payment_reservations WHERE intent_id=NEW.id;
        IF NOT FOUND OR held.state<>'consumed' OR held.ledger_entry_id IS DISTINCT FROM entry.id THEN
          RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='International settlement requires a consumed reservation';
        END IF;
      END IF;
    END IF;
  ELSIF NEW.ledger_entry_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Accounting may only be bound to confirmed success';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sf_payment_intent_guard BEFORE INSERT OR UPDATE ON public.sf_payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_guard_intent();

CREATE FUNCTION public.sf_payments_guard_attempt() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE intent public.sf_payment_intents%ROWTYPE; proof public.sf_payment_confirmations%ROWTYPE;
BEGIN
  SELECT * INTO intent FROM public.sf_payment_intents WHERE id=NEW.intent_id;
  IF NOT FOUND OR NEW.currency<>intent.currency OR
    NEW.amount_minor<>(CASE WHEN NEW.direction='payin' THEN intent.sender_total_minor ELSE intent.recipient_total_minor END)
    OR (intent.kind='deposit' AND NEW.direction<>'payin')
    OR (intent.kind='international' AND NEW.direction<>'payout') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment leg is incompatible with its immutable intent';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'prepared' OR NEW.dispatched_at IS NOT NULL OR NEW.provider_reference_hash IS NOT NULL
      OR NEW.provider_reference IS NOT NULL OR NEW.final_confirmation_id IS NOT NULL
      OR intent.state IN ('succeeded','failed','refund_due') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment leg must start prepared';
    END IF;
    IF NEW.direction='payout' AND intent.kind='inter-network' AND NOT EXISTS (
      SELECT 1 FROM public.sf_payment_attempts WHERE intent_id=intent.id AND direction='payin' AND status='succeeded'
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='No disbursement before collection confirmation';
    END IF;
    IF intent.kind='international' AND NOT EXISTS (
      SELECT 1 FROM public.sf_wallet_payment_reservations WHERE intent_id=intent.id AND state='active'
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Wallet funds must be reserved before dispatch';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','provider_reference','provider_reference_hash','final_confirmation_id','dispatched_at','updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','provider_reference','provider_reference_hash','final_confirmation_id','dispatched_at','updated_at'])
    OR (OLD.provider_reference_hash IS NOT NULL AND
      (NEW.provider_reference_hash IS DISTINCT FROM OLD.provider_reference_hash OR NEW.provider_reference IS DISTINCT FROM OLD.provider_reference))
    OR (OLD.final_confirmation_id IS NOT NULL AND NEW.final_confirmation_id IS DISTINCT FROM OLD.final_confirmation_id)
    OR (OLD.dispatched_at IS NOT NULL AND NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment leg financial snapshot is immutable';
  END IF;
  IF NEW.status<>OLD.status AND NOT (
    (OLD.status='prepared' AND NEW.status IN ('dispatching','failed'))
    OR (OLD.status='dispatching' AND NEW.status IN ('pending','uncertain','succeeded','failed'))
    OR (OLD.status='pending' AND NEW.status IN ('uncertain','succeeded','failed'))
    OR (OLD.status='uncertain' AND NEW.status IN ('pending','succeeded','failed'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid payment leg transition; redispatch is forbidden';
  END IF;
  IF OLD.status='prepared' AND NEW.status='dispatching' THEN
    IF intent.state IN ('succeeded','failed','refund_due') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Terminal payment must not be dispatched';
    END IF;
    IF intent.kind='international' THEN
      -- Claim the hold in the same transaction as the dispatch marker. Updating
      -- the row, rather than just locking it, also protects old MVCC snapshots.
      UPDATE public.sf_wallet_payment_reservations SET updated_at=clock_timestamp()
        WHERE intent_id=intent.id AND state='active';
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reserved funds were released before dispatch';
      END IF;
    END IF;
    NEW.dispatched_at=clock_timestamp();
  ELSIF NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Only dispatch can create a dispatch timestamp';
  END IF;
  IF NEW.dispatched_at IS NULL AND NEW.provider_reference_hash IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Undispatched payment cannot bind a provider reference';
  END IF;
  IF NEW.status IN ('succeeded','failed') AND NEW.dispatched_at IS NOT NULL THEN
    SELECT * INTO proof FROM public.sf_payment_confirmations WHERE id=NEW.final_confirmation_id;
    IF NOT FOUND OR proof.attempt_id<>NEW.id OR proof.provider_status<>NEW.status
      OR proof.provider_reference_hash IS DISTINCT FROM NEW.provider_reference_hash THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Final payment leg state requires matching verified evidence';
    END IF;
  ELSIF NEW.final_confirmation_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Non-final leg cannot bind final evidence';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sf_payment_attempt_guard BEFORE INSERT OR UPDATE ON public.sf_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_guard_attempt();

CREATE FUNCTION public.sf_payments_guard_confirmation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE leg public.sf_payment_attempts%ROWTYPE;
BEGIN
  SELECT * INTO leg FROM public.sf_payment_attempts WHERE id=NEW.attempt_id;
  IF NOT FOUND OR leg.dispatched_at IS NULL OR leg.provider_reference_hash IS NULL
    OR leg.provider_reference_hash<>NEW.provider_reference_hash
    OR leg.amount_minor<>NEW.amount_minor OR leg.currency<>NEW.currency THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Confirmation does not match its dispatched payment';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sf_payment_confirmation_guard BEFORE INSERT ON public.sf_payment_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_guard_confirmation();
CREATE TRIGGER sf_payment_confirmation_immutable BEFORE UPDATE ON public.sf_payment_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_reject_history_mutation();

CREATE FUNCTION public.sf_payments_guard_reservation() RETURNS trigger
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
  -- A row-version change is required as well as a row lock: without it,
  -- REPEATABLE READ transactions can otherwise miss a newly committed hold.
  UPDATE public.sf_wallets SET updated_at=clock_timestamp() WHERE id=wallet.id;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'active' OR NEW.confirmation_id IS NOT NULL OR NEW.ledger_entry_id IS NOT NULL
      OR account_status<>'active' OR wallet.status::text<>'active'
      OR intent.state NOT IN ('created','paying') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reservation requires an active account and wallet';
    END IF;
    SELECT coalesce(sum(amount_minor),0) INTO held FROM public.sf_wallet_payment_reservations
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
CREATE TRIGGER sf_payment_reservation_guard BEFORE INSERT OR UPDATE ON public.sf_wallet_payment_reservations
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_guard_reservation();

CREATE FUNCTION public.sf_payments_wallet_floor() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE held numeric;
BEGIN
  SELECT coalesce(sum(amount_minor),0) INTO held FROM public.sf_wallet_payment_reservations
    WHERE wallet_id=OLD.id AND state='active';
  IF held>0 AND (NEW.balance_minor<held OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Wallet funds are reserved for an unresolved payment';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sf_payment_wallet_reserved_floor BEFORE UPDATE OF balance_minor,currency,user_id ON public.sf_wallets
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_wallet_floor();

CREATE FUNCTION public.sf_payments_transaction_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE intent public.sf_payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO intent FROM public.sf_payment_intents WHERE transaction_id=OLD.id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW)-ARRAY['status','provider_reference','provider_reference_lookup_hash','deleted_at','deleted_by','deletion_reason','updated_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','provider_reference','provider_reference_lookup_hash','deleted_at','deleted_by','deletion_reason','updated_at'])
    OR (OLD.status::text IN ('succeeded','failed') AND NEW.status IS DISTINCT FROM OLD.status)
    OR (NEW.status::text='succeeded' AND intent.state<>'succeeded')
    OR (NEW.status::text='failed' AND intent.state<>'failed')
    OR (OLD.provider_reference_lookup_hash IS NOT NULL AND (
      NEW.provider_reference_lookup_hash IS DISTINCT FROM OLD.provider_reference_lookup_hash
      OR NEW.provider_reference IS DISTINCT FROM OLD.provider_reference
    )) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Transaction snapshot or confirmed status cannot be forged';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sf_payment_transaction_snapshot_guard BEFORE UPDATE ON public.sf_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_transaction_snapshot();

DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['sf_payment_intents','sf_payment_attempts','sf_payment_confirmations','sf_wallet_payment_reservations','sf_payment_schema_versions']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sf_payments_reject_history_mutation()',name||'_no_delete',name);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.sf_payments_reject_history_mutation()',name||'_no_truncate',name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',name);
  END LOOP;
END $$;
CREATE TRIGGER sf_payment_schema_versions_immutable BEFORE UPDATE ON public.sf_payment_schema_versions
  FOR EACH ROW EXECUTE FUNCTION public.sf_payments_reject_history_mutation();
REVOKE ALL ON FUNCTION public.sf_payments_reject_history_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_payments_guard_intent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_payments_guard_attempt() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_payments_guard_confirmation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_payments_guard_reservation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_payments_wallet_floor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_payments_transaction_snapshot() FROM PUBLIC;
