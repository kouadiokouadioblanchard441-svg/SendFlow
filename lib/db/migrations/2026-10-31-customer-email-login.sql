-- Searchable, privacy-preserving email identifier for customer sign-in.
-- The encrypted email remains the source value; this keyed hash is only a lookup index.
ALTER TABLE public.sf_users
  ADD COLUMN IF NOT EXISTS email_lookup_hash varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS sf_users_email_lookup_hash_uq
  ON public.sf_users (email_lookup_hash);
