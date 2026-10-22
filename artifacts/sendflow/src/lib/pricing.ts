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
  enabled: boolean;
  minPhoneDigits: number;
  maxPhoneDigits: number;
  operations: { deposit: boolean; interNetwork: boolean; international: boolean };
};

export type PricingFeeMap = Partial<Record<PricingCategoryId, number>>;

export type PricingOperator = {
  id: string;
  countryId: string;
  name: string;
  shortName: string;
  initials: string;
  brand: 'orange' | 'wave' | 'mtn' | 'moov' | 'generic';
  logoUrl: string | null;
  requiresOtp: boolean;
  otpCommand: string | null;
  fees: PricingFeeMap;
  operations: { deposit: boolean; interNetwork: boolean; international: boolean };
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

export function formatPricingFeeRate(rate: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(rate * 100)} %`;
}