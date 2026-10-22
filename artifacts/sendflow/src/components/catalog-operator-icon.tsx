import { useGetPublicPricing, getGetPublicPricingQueryKey } from '@workspace/api-client-react';
import type { PublicPricingOperator } from '@workspace/api-client-react';
import { OperatorMark } from '@/components/operator-mark';

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findCatalogOperator(
  operators: PublicPricingOperator[],
  operatorCode: string,
): PublicPricingOperator | undefined {
  const code = normalize(operatorCode);
  if (!code || code === 'unknown' || code === 'sendflow') return undefined;

  return operators.find((operator) => normalize(operator.id) === code)
    ?? operators.find((operator) => normalize(operator.brand) === code)
    ?? operators.find((operator) => normalize(operator.id).startsWith(code))
    ?? operators.find((operator) => normalize(operator.name).includes(code))
    ?? operators.find((operator) => normalize(operator.shortName).includes(code));
}

export function CatalogOperatorIcon({ operatorCode }: { operatorCode: string }) {
  const query = useGetPublicPricing({
    query: { queryKey: getGetPublicPricingQueryKey() },
  });
  const operator = findCatalogOperator(query.data?.operators ?? [], operatorCode);

  if (operator) return <OperatorMark operator={operator} />;
  const fallback = operatorCode === 'unknown' ? '—' : operatorCode.slice(0, 3).toUpperCase();
  return <strong data-testid={`text-operator-fallback-${operatorCode}`}>{fallback}</strong>;
}
