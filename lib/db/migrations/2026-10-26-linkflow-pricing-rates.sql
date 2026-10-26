BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Create an independent, unconfigured LinkFlow rate for every existing operator.
-- LinkFlow fees must be configured separately; never inherit another category.
INSERT INTO public.sf_operator_pricing_rates (
  operator_id,
  country_code,
  category_id,
  fee_percent,
  version,
  created_by,
  updated_by,
  created_at,
  updated_at
)
SELECT
  operator.operator_id,
  operator.country_code,
  'linkflow',
  NULL,
  1,
  'migration:linkflow-pricing-category',
  'migration:linkflow-pricing-category',
  now(),
  now()
FROM public.sf_operator_catalog AS operator
ON CONFLICT (operator_id, category_id) DO NOTHING;

COMMIT;
