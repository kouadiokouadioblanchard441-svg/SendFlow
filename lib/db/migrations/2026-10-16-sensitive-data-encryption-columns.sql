BEGIN;

ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS birth_date date,
  ALTER COLUMN phone TYPE varchar(512),
  ALTER COLUMN display_name TYPE varchar(512),
  ADD COLUMN IF NOT EXISTS phone_lookup_hash varchar(64),
  ADD COLUMN IF NOT EXISTS display_name_lookup_hash varchar(64),
  ADD COLUMN IF NOT EXISTS birth_date_encrypted text;

CREATE UNIQUE INDEX IF NOT EXISTS sf_users_phone_lookup_hash_uq
  ON public.sf_users (phone_lookup_hash);
CREATE INDEX IF NOT EXISTS sf_users_display_name_lookup_hash_idx
  ON public.sf_users (display_name_lookup_hash);

ALTER TABLE public.sf_contacts
  ALTER COLUMN label TYPE varchar(512),
  ALTER COLUMN phone TYPE varchar(512);

ALTER TABLE public.sf_transactions
  ALTER COLUMN sender_phone TYPE varchar(512),
  ALTER COLUMN recipient_phone TYPE varchar(512),
  ALTER COLUMN provider_reference TYPE varchar(512),
  ADD COLUMN IF NOT EXISTS sender_phone_lookup_hash varchar(64),
  ADD COLUMN IF NOT EXISTS recipient_phone_lookup_hash varchar(64),
  ADD COLUMN IF NOT EXISTS provider_reference_lookup_hash varchar(64);

CREATE INDEX IF NOT EXISTS sf_transactions_sender_phone_hash_idx
  ON public.sf_transactions (sender_phone_lookup_hash);
CREATE INDEX IF NOT EXISTS sf_transactions_recipient_phone_hash_idx
  ON public.sf_transactions (recipient_phone_lookup_hash);
CREATE INDEX IF NOT EXISTS sf_transactions_provider_ref_hash_idx
  ON public.sf_transactions (provider_reference_lookup_hash);

COMMIT;
