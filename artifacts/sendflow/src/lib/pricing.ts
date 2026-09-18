export type PricingCategoryId = 'deposit' | 'inter-network' | 'international';

export type PricingCategory = {
  id: PricingCategoryId;
  label: string;
  shortLabel: string;
  description: string;
};

export type PricingCountry = {
  id: string;
  name: string;
  dialCode: string;
  initials: string;
  flag: string;
};

export type PricingFeeMap = Partial<Record<PricingCategoryId, number>>;

export type PricingOperator = {
  id: string;
  countryId: string;
  name: string;
  initials: string;
  brand: 'orange' | 'wave' | 'mtn' | 'moov' | 'generic';
  fees: PricingFeeMap;
};

export type PricingOperatorRate = PricingOperator & {
  categoryId: PricingCategoryId;
  feeRate: number;
  feeLabel: string;
};

export type PricingCatalog = {
  categories: PricingCategory[];
  countries: PricingCountry[];
  operators: PricingOperator[];
};

export interface PricingProvider {
  getCatalog(): PricingCatalog;
  getOperators(countryId: string, categoryId: PricingCategoryId): PricingOperatorRate[];
}

const categories: PricingCategory[] = [
  {
    id: 'deposit',
    label: 'Dépôt',
    shortLabel: 'Dépôt',
    description: 'Alimenter votre wallet SendFlow',
  },
  {
    id: 'inter-network',
    label: 'Transfert inter réseau',
    shortLabel: 'Inter réseau',
    description: 'Transférer entre deux réseaux',
  },
  {
    id: 'international',
    label: 'Transfert international',
    shortLabel: 'International',
    description: 'Envoyer vers un autre pays',
  },
];

const countries: PricingCountry[] = [
  { id: 'ci', name: 'Côte d’Ivoire', dialCode: '+225', initials: 'CI', flag: '🇨🇮' },
  { id: 'sn', name: 'Sénégal', dialCode: '+221', initials: 'SN', flag: '🇸🇳' },
  { id: 'bf', name: 'Burkina Faso', dialCode: '+226', initials: 'BF', flag: '🇧🇫' },
  { id: 'bj', name: 'Bénin', dialCode: '+229', initials: 'BJ', flag: '🇧🇯' },
  { id: 'ml', name: 'Mali', dialCode: '+223', initials: 'ML', flag: '🇲🇱' },
  { id: 'ne', name: 'Niger', dialCode: '+227', initials: 'NE', flag: '🇳🇪' },
  { id: 'tg', name: 'Togo', dialCode: '+228', initials: 'TG', flag: '🇹🇬' },
  { id: 'cm', name: 'Cameroun', dialCode: '+237', initials: 'CM', flag: '🇨🇲' },
  { id: 'cg', name: 'Congo-Brazzaville', dialCode: '+242', initials: 'CG', flag: '🇨🇬' },
];

const operators: PricingOperator[] = [
  { id: 'orange-ci', countryId: 'ci', name: 'Orange Money', initials: 'O', brand: 'orange', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'wave-ci', countryId: 'ci', name: 'Wave', initials: 'W', brand: 'wave', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'mtn-ci', countryId: 'ci', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'moov-ci', countryId: 'ci', name: 'Moov Money', initials: 'M', brand: 'moov', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'orange-sn', countryId: 'sn', name: 'Orange Money', initials: 'O', brand: 'orange', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'wave-sn', countryId: 'sn', name: 'Wave', initials: 'W', brand: 'wave', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'free-sn', countryId: 'sn', name: 'Free Money', initials: 'F', brand: 'generic', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'orange-bf', countryId: 'bf', name: 'Orange Money', initials: 'O', brand: 'orange', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'moov-bf', countryId: 'bf', name: 'Moov Money', initials: 'M', brand: 'moov', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'telecel-bf', countryId: 'bf', name: 'Telecel Money', initials: 'T', brand: 'generic', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'mtn-bj', countryId: 'bj', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'moov-bj', countryId: 'bj', name: 'Moov Money', initials: 'M', brand: 'moov', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'orange-ml', countryId: 'ml', name: 'Orange Money', initials: 'O', brand: 'orange', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'moov-ml', countryId: 'ml', name: 'Moov Money', initials: 'M', brand: 'moov', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'airtel-ne', countryId: 'ne', name: 'Airtel Money', initials: 'A', brand: 'generic', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'moov-ne', countryId: 'ne', name: 'Moov Money', initials: 'M', brand: 'moov', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'tmoney-tg', countryId: 'tg', name: 'TMoney', initials: 'T', brand: 'generic', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'flooz-tg', countryId: 'tg', name: 'Flooz', initials: 'F', brand: 'generic', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'orange-cm', countryId: 'cm', name: 'Orange Money', initials: 'O', brand: 'orange', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'mtn-cm', countryId: 'cm', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'airtel-cg', countryId: 'cg', name: 'Airtel Money', initials: 'A', brand: 'generic', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
  { id: 'mtn-cg', countryId: 'cg', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', fees: { deposit: 0.03, 'inter-network': 0.03, international: 0.03 } },
];

const catalog: PricingCatalog = { categories, countries, operators };

export const pricingProvider: PricingProvider = {
  getCatalog: () => catalog,
  getOperators: (countryId, categoryId) => operators.flatMap((operator) => {
    const feeRate = operator.fees[categoryId];
    if (operator.countryId !== countryId || feeRate === undefined) return [];

    return [{
      ...operator,
      categoryId,
      feeRate,
      feeLabel: formatPricingFeeRate(feeRate),
    }];
  }),
};

export function formatPricingFeeRate(rate: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(rate * 100)} %`;
}