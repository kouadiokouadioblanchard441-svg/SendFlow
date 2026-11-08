-- Restore the email-auth columns currently used by SendFlow without backfilling
-- or rewriting customer data. Existing SMS rows keep the compatible defaults.
BEGIN;

SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '12s';

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS email_encrypted text,
  ADD COLUMN IF NOT EXISTS email_lookup_hash varchar(64),
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_marketing_unsubscribed_at timestamptz;

ALTER TABLE public.sf_phone_otp_challenges
  ADD COLUMN IF NOT EXISTS email_hash varchar(64),
  ADD COLUMN IF NOT EXISTS code_hash varchar(64),
  ADD COLUMN IF NOT EXISTS provider_message_id varchar(255),
  ADD COLUMN IF NOT EXISTS delivery_channel varchar(8) NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.sf_registration_settings
  ADD COLUMN IF NOT EXISTS email_verification_enabled boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS sf_users_email_lookup_hash_uq
  ON public.sf_users (email_lookup_hash);

CREATE INDEX IF NOT EXISTS sf_phone_otp_email_created_idx
  ON public.sf_phone_otp_challenges (email_hash, created_at);

CREATE INDEX IF NOT EXISTS sf_phone_otp_email_purpose_idx
  ON public.sf_phone_otp_challenges (email_hash, purpose, status, expires_at);

-- The original phone-only check rejects verified email challenges. Replace
-- only that legacy definition; the channel-aware version preserves the
-- existing SMS invariant and adds the matching email invariant.
DO $$
DECLARE
  existing_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO existing_definition
    FROM pg_constraint
   WHERE conname = 'sf_phone_otp_verified_check'
     AND conrelid = 'public.sf_phone_otp_challenges'::regclass;

  IF existing_definition IS NOT NULL
     AND position('delivery_channel' IN existing_definition) = 0 THEN
    ALTER TABLE public.sf_phone_otp_challenges
      DROP CONSTRAINT sf_phone_otp_verified_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'sf_phone_otp_verified_check'
       AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_verified_check
      CHECK (
        phone_verified = (
          delivery_channel = 'sms'
          AND status = 'verified'
          AND verified_at IS NOT NULL
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'sf_phone_otp_delivery_channel_check'
       AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_delivery_channel_check
      CHECK (delivery_channel IN ('sms', 'email'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'sf_phone_otp_email_challenge_check'
       AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_email_challenge_check
      CHECK (delivery_channel <> 'email' OR email_hash IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'sf_phone_otp_email_code_check'
       AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_email_code_check
      CHECK (
        delivery_channel <> 'email'
        OR status NOT IN ('starting', 'pending')
        OR code_hash IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'sf_phone_otp_email_verified_check'
       AND conrelid = 'public.sf_phone_otp_challenges'::regclass
  ) THEN
    ALTER TABLE public.sf_phone_otp_challenges
      ADD CONSTRAINT sf_phone_otp_email_verified_check
      CHECK (
        email_verified = (
          delivery_channel = 'email'
          AND status = 'verified'
          AND verified_at IS NOT NULL
        )
      );
  END IF;
END
$$;

COMMIT;
