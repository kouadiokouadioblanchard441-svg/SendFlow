CREATE TABLE public.sf_customer_biometric_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE CASCADE,
  credential_id text NOT NULL,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE UNIQUE INDEX sf_customer_biometric_credential_id_uq
  ON public.sf_customer_biometric_credentials (credential_id);
CREATE INDEX sf_customer_biometric_user_created_idx
  ON public.sf_customer_biometric_credentials (user_id, created_at);

CREATE TABLE public.sf_customer_biometric_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.sf_users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sf_customer_sessions(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  purpose varchar(20) NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  expected_origin text NOT NULL,
  rp_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sf_customer_biometric_challenge_session_expiry_idx
  ON public.sf_customer_biometric_challenges (session_id, expires_at);
