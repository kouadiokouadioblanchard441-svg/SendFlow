ALTER TABLE public.sf_developer_api_keys
  DROP CONSTRAINT IF EXISTS sf_developer_api_keys_public_key_check;

ALTER TABLE public.sf_developer_api_keys
  ADD CONSTRAINT sf_developer_api_keys_public_key_check
  CHECK (public_key ~ '^sfpk_(live|test)_[A-Za-z0-9_-]{43}$');
