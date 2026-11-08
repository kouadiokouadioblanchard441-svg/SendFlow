-- Atomic wallet-wide reservation accounting. This migration adds only a
-- separate aggregate and payout/payment reservation guards; it does not replace
-- existing PAYIN triggers, webhook constraints, or operation-route rules.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.sf_wallet_payment_reservations') IS NULL
    OR to_regclass('public.sf_payout_requests') IS NULL
    OR to_regclass('public.sf_wallets') IS NULL THEN
    RAISE EXCEPTION 'Wallet reservation accounting prerequisites are missing';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sf_wallet_reservation_totals (
  wallet_id uuid PRIMARY KEY
    REFERENCES public.sf_wallets(id) ON DELETE RESTRICT,
  reserved_minor bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_wallet_reservation_totals_amount_check
    CHECK (reserved_minor BETWEEN 0 AND 9007199254740991)
);

WITH active_holds AS (
  SELECT wallet_id, sum(amount_minor::numeric) AS reserved_minor
  FROM public.sf_wallet_payment_reservations
  WHERE state = 'active'
  GROUP BY wallet_id
  UNION ALL
  SELECT wallet_id, sum(total_debit_minor::numeric) AS reserved_minor
  FROM public.sf_payout_requests
  WHERE reservation_state = 'active'
  GROUP BY wallet_id
), totals AS (
  SELECT wallet_id, sum(reserved_minor) AS reserved_minor
  FROM active_holds
  GROUP BY wallet_id
)
INSERT INTO public.sf_wallet_reservation_totals(wallet_id, reserved_minor)
SELECT wallet_id, reserved_minor::bigint FROM totals
ON CONFLICT(wallet_id) DO UPDATE
SET reserved_minor = EXCLUDED.reserved_minor,
    updated_at = clock_timestamp();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sf_wallet_reservation_totals AS r
    JOIN public.sf_wallets AS w ON w.id = r.wallet_id
    WHERE r.reserved_minor > w.balance_minor
  ) THEN
    RAISE EXCEPTION 'Existing active reservations exceed a wallet balance';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sf_wallet_reservation_total_apply(
  p_wallet_id uuid,
  p_delta bigint,
  p_balance_minor bigint
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE current_total bigint;
BEGIN
  IF p_delta = 0 THEN RETURN; END IF;
  IF p_delta > 0 THEN
    IF p_delta > p_balance_minor THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Insufficient unreserved wallet funds';
    END IF;
    INSERT INTO public.sf_wallet_reservation_totals(wallet_id, reserved_minor)
    VALUES (p_wallet_id, p_delta)
    ON CONFLICT (wallet_id) DO UPDATE
    SET reserved_minor = public.sf_wallet_reservation_totals.reserved_minor + EXCLUDED.reserved_minor,
        updated_at = clock_timestamp()
    WHERE public.sf_wallet_reservation_totals.reserved_minor + EXCLUDED.reserved_minor
      <= p_balance_minor
    RETURNING reserved_minor INTO current_total;
  ELSE
    UPDATE public.sf_wallet_reservation_totals
    SET reserved_minor = reserved_minor + p_delta,
        updated_at = clock_timestamp()
    WHERE wallet_id = p_wallet_id
      AND reserved_minor + p_delta >= 0
    RETURNING reserved_minor INTO current_total;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Insufficient unreserved wallet funds';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sf_wallet_payment_reservation_total_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE wallet_id uuid; wallet_balance bigint; delta bigint := 0;
BEGIN
  wallet_id := NEW.wallet_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state = 'active' THEN delta := NEW.amount_minor; END IF;
  ELSE
    IF OLD.wallet_id IS DISTINCT FROM NEW.wallet_id THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Reservation wallet is immutable';
    END IF;
    IF OLD.state = 'active' AND NEW.state <> 'active' THEN
      delta := -OLD.amount_minor;
    ELSIF OLD.state <> 'active' AND NEW.state = 'active' THEN
      delta := NEW.amount_minor;
    ELSIF OLD.state = 'active' AND NEW.state = 'active'
      AND NEW.amount_minor IS DISTINCT FROM OLD.amount_minor THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Active reservation amount is immutable';
    END IF;
  END IF;
  IF delta = 0 THEN RETURN NEW; END IF;

  SELECT balance_minor INTO wallet_balance
  FROM public.sf_wallets WHERE id = wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Reservation wallet is missing';
  END IF;
  PERFORM public.sf_wallet_reservation_total_apply(wallet_id, delta, wallet_balance);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sf_payout_reservation_total_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE wallet_id uuid; wallet_balance bigint; delta bigint := 0;
BEGIN
  wallet_id := NEW.wallet_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.reservation_state <> 'none' OR NEW.status <> 'created' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payout must start without a reservation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.wallet_id IS DISTINCT FROM NEW.wallet_id
    OR OLD.total_debit_minor IS DISTINCT FROM NEW.total_debit_minor
    OR OLD.currency IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payout reservation snapshot is immutable';
  END IF;
  IF OLD.reservation_state IN ('consumed', 'released')
    AND NEW.reservation_state IS DISTINCT FROM OLD.reservation_state THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payout reservation cannot be reopened';
  END IF;
  IF OLD.reservation_state = 'none' AND NEW.reservation_state = 'active' THEN
    IF NEW.status <> 'funds_reserved' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payout reservation requires funds_reserved state';
    END IF;
    delta := NEW.total_debit_minor;
  ELSIF OLD.reservation_state = 'active' AND NEW.reservation_state IN ('consumed', 'released') THEN
    delta := -OLD.total_debit_minor;
  ELSIF OLD.reservation_state <> NEW.reservation_state
    AND NEW.reservation_state NOT IN ('active', 'consumed', 'released') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid payout reservation transition';
  END IF;
  IF delta = 0 THEN RETURN NEW; END IF;

  SELECT balance_minor INTO wallet_balance
  FROM public.sf_wallets WHERE id = wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payout wallet is missing';
  END IF;
  PERFORM public.sf_wallet_reservation_total_apply(wallet_id, delta, wallet_balance);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sf_wallet_reservation_total_floor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE reserved bigint;
BEGIN
  SELECT reserved_minor INTO reserved
  FROM public.sf_wallet_reservation_totals WHERE wallet_id = OLD.id;
  reserved := coalesce(reserved, 0);
  IF NEW.balance_minor < reserved
    OR (reserved > 0 AND (
      NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
    )) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Wallet funds are reserved for an unresolved payment or payout';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sf_z_payment_reservation_total ON public.sf_wallet_payment_reservations;
CREATE TRIGGER sf_z_payment_reservation_total
  BEFORE INSERT OR UPDATE ON public.sf_wallet_payment_reservations
  FOR EACH ROW EXECUTE FUNCTION public.sf_wallet_payment_reservation_total_guard();

DROP TRIGGER IF EXISTS sf_z_payout_reservation_total ON public.sf_payout_requests;
CREATE TRIGGER sf_z_payout_reservation_total
  BEFORE INSERT OR UPDATE ON public.sf_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.sf_payout_reservation_total_guard();

DROP TRIGGER IF EXISTS sf_z_wallet_reservation_total_floor ON public.sf_wallets;
CREATE TRIGGER sf_z_wallet_reservation_total_floor
  BEFORE UPDATE OF balance_minor, currency, user_id ON public.sf_wallets
  FOR EACH ROW EXECUTE FUNCTION public.sf_wallet_reservation_total_floor();

REVOKE ALL ON TABLE public.sf_wallet_reservation_totals FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_wallet_reservation_total_apply(uuid, bigint, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_wallet_payment_reservation_total_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_payout_reservation_total_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_wallet_reservation_total_floor() FROM PUBLIC;
COMMIT;
