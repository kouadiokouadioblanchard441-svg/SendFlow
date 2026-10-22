BEGIN;

CREATE TABLE IF NOT EXISTS public.sf_countries (
  country_code varchar(2) PRIMARY KEY,
  country_name varchar(120) NOT NULL,
  phone_prefix varchar(8) NOT NULL,
  min_phone_digits integer NOT NULL,
  max_phone_digits integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  deposit_enabled boolean NOT NULL DEFAULT false,
  inter_network_enabled boolean NOT NULL DEFAULT false,
  international_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_by varchar(255) NOT NULL,
  updated_by varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_countries_code_format_check CHECK (country_code ~ '^[a-z]{2}$'),
  CONSTRAINT sf_countries_phone_prefix_format_check CHECK (phone_prefix ~ '^\+[1-9][0-9]{0,3}$'),
  CONSTRAINT sf_countries_phone_digits_range_check
    CHECK (min_phone_digits BETWEEN 4 AND 15 AND max_phone_digits BETWEEN min_phone_digits AND 15
      AND max_phone_digits + length(phone_prefix) - 1 <= 15)
);

INSERT INTO public.sf_countries
  (country_code, country_name, phone_prefix, min_phone_digits, max_phone_digits, enabled, created_by, updated_by)
VALUES
  ('ci', 'Côte d’Ivoire', '+225', 10, 10, true, 'system:migration', 'system:migration'),
  ('sn', 'Sénégal', '+221', 9, 9, true, 'system:migration', 'system:migration'),
  ('bf', 'Burkina Faso', '+226', 8, 8, true, 'system:migration', 'system:migration'),
  ('bj', 'Bénin', '+229', 10, 10, true, 'system:migration', 'system:migration'),
  ('ml', 'Mali', '+223', 9, 9, true, 'system:migration', 'system:migration'),
  ('ne', 'Niger', '+227', 9, 9, true, 'system:migration', 'system:migration'),
  ('tg', 'Togo', '+228', 8, 8, true, 'system:migration', 'system:migration'),
  ('cm', 'Cameroun', '+237', 9, 9, true, 'system:migration', 'system:migration'),
  ('cg', 'Congo-Brazzaville', '+242', 7, 12, true, 'system:migration', 'system:migration')
ON CONFLICT (country_code) DO NOTHING;

ALTER TABLE public.sf_operator_catalog
  ADD COLUMN IF NOT EXISTS deposit_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inter_network_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS international_enabled boolean NOT NULL DEFAULT false;

DO $$
DECLARE first_creation boolean;
BEGIN
  first_creation := to_regclass('public.sf_operation_aggregator_routes') IS NULL;
  CREATE TABLE IF NOT EXISTS public.sf_operation_aggregator_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type varchar(16) NOT NULL,
    scope_key varchar(100) NOT NULL,
    country_code varchar(2) NOT NULL,
    operator_id varchar(60),
    operation varchar(24) NOT NULL,
    aggregator_code varchar(60),
    version integer NOT NULL DEFAULT 1,
    created_by varchar(255) NOT NULL,
    updated_by varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sf_operation_aggregator_routes_operation_check
      CHECK (operation IN ('deposit', 'inter-network', 'international'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS sf_operation_aggregator_routes_scope_operation_uq
    ON public.sf_operation_aggregator_routes (scope_type, scope_key, operation);
  CREATE INDEX IF NOT EXISTS sf_operation_aggregator_routes_country_idx
    ON public.sf_operation_aggregator_routes (country_code);

  -- Copy legacy configuration once without modifying the table used by old deployments.
  -- Rerunning this migration must never create routes for another operation.
  IF first_creation AND to_regclass('public.sf_payment_aggregator_routes') IS NOT NULL THEN
    INSERT INTO public.sf_operation_aggregator_routes
      (scope_type, scope_key, country_code, operator_id, operation, aggregator_code, version,
       created_by, updated_by, created_at, updated_at)
    SELECT route.scope_type, route.scope_key, route.country_code, route.operator_id,
           operation.operation, route.aggregator_code, route.version,
           route.created_by, route.updated_by, route.created_at, route.updated_at
    FROM public.sf_payment_aggregator_routes AS route
    CROSS JOIN (VALUES ('deposit'), ('inter-network'), ('international')) AS operation(operation)
    ON CONFLICT (scope_type, scope_key, operation) DO NOTHING;
  END IF;
END $$;

COMMIT;
