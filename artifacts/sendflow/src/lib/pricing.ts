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
};

export type PricingOperator = {
  id: string;
  countryId: string;
  name: string;
  initials: string;
  brand: 'orange' | 'wave' | 'mtn' | 'moov' | 'generic';
  feeLabel: string;
  feeRate: number;
  availableFor: PricingCategoryId[];
};

export type PricingCatalog = {
  categories: PricingCategory[];
  countries: PricingCountry[];
  operators: PricingOperator[];
};

export interface PricingProvider {
  getCatalog(): PricingCatalog;
  getOperators(countryId: string, categoryId: PricingCategoryId): PricingOperator[];
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
  { id: 'ci', name: 'Côte d’Ivoire', dialCode: '+225', initials: 'CI' },
  { id: 'sn', name: 'Sénégal', dialCode: '+221', initials: 'SN' },
  { id: 'bf', name: 'Burkina Faso', dialCode: '+226', initials: 'BF' },
  { id: 'bj', name: 'Bénin', dialCode: '+229', initials: 'BJ' },
  { id: 'ml', name: 'Mali', dialCode: '+223', initials: 'ML' },
  { id: 'ne', name: 'Niger', dialCode: '+227', initials: 'NE' },
  { id: 'tg', name: 'Togo', dialCode: '+228', initials: 'TG' },
  { id: 'cm', name: 'Cameroun', dialCode: '+237', initials: 'CM' },
  { id: 'cg', name: 'Congo-Brazzaville', dialCode: '+242', initials: 'CG' },
];

const operators: PricingOperator[] = [
  { id: 'orange-ci', countryId: 'ci', name: 'Orange Money', initials: 'O', brand: 'orange', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'wave-ci', countryId: 'ci', name: 'Wave', initials: 'W', brand: 'wave', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'mtn-ci', countryId: 'ci', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'moov-ci', countryId: 'ci', name: 'Moov Money', initials: 'M', brand: 'moov', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'orange-sn', countryId: 'sn', name: 'Orange Money', initials: 'O', brand: 'orange', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'wave-sn', countryId: 'sn', name: 'Wave', initials: 'W', brand: 'wave', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'free-sn', countryId: 'sn', name: 'Free Money', initials: 'F', brand: 'generic', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'orange-bf', countryId: 'bf', name: 'Orange Money', initials: 'O', brand: 'orange', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'moov-bf', countryId: 'bf', name: 'Moov Money', initials: 'M', brand: 'moov', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'telecel-bf', countryId: 'bf', name: 'Telecel Money', initials: 'T', brand: 'generic', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'mtn-bj', countryId: 'bj', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'moov-bj', countryId: 'bj', name: 'Moov Money', initials: 'M', brand: 'moov', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'orange-ml', countryId: 'ml', name: 'Orange Money', initials: 'O', brand: 'orange', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'moov-ml', countryId: 'ml', name: 'Moov Money', initials: 'M', brand: 'moov', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'airtel-ne', countryId: 'ne', name: 'Airtel Money', initials: 'A', brand: 'generic', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'moov-ne', countryId: 'ne', name: 'Moov Money', initials: 'M', brand: 'moov', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'tmoney-tg', countryId: 'tg', name: 'TMoney', initials: 'T', brand: 'generic', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'flooz-tg', countryId: 'tg', name: 'Flooz', initials: 'F', brand: 'generic', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'orange-cm', countryId: 'cm', name: 'Orange Money', initials: 'O', brand: 'orange', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'mtn-cm', countryId: 'cm', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'airtel-cg', countryId: 'cg', name: 'Airtel Money', initials: 'A', brand: 'generic', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
  { id: 'mtn-cg', countryId: 'cg', name: 'MTN Mobile Money', initials: 'MTN', brand: 'mtn', feeLabel: '3 %', feeRate: 0.03, availableFor: ['deposit', 'inter-network', 'international'] },
];

const catalog: PricingCatalog = { categories, countries, operators };

export const pricingProvider: PricingProvider = {
  getCatalog: () => catalog,
  getOperators: (countryId, categoryId) => operators.filter(
    (operator) => operator.countryId === countryId && operator.availableFor.includes(categoryId),
  ),
};

export const pricingFeeRate = 0.03;