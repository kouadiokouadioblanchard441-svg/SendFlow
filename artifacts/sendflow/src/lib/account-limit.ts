export type AccountLimitStatus = 'unverified' | 'pending' | 'review' | 'verified' | 'failed';

export type AccountLimitConfig = {
  currency: 'FCFA';
  monthlyLimit: number;
  sentAmount: number;
  status: AccountLimitStatus;
};

export interface AccountLimitProvider {
  getAccountLimit: () => AccountLimitConfig;
}

export const temporaryAccountLimits: Record<AccountLimitStatus, AccountLimitConfig> = {
  unverified: {
    currency: 'FCFA',
    monthlyLimit: 200000,
    sentAmount: 11760,
    status: 'unverified',
  },
  pending: {
    currency: 'FCFA',
    monthlyLimit: 200000,
    sentAmount: 11760,
    status: 'pending',
  },
  review: {
    currency: 'FCFA',
    monthlyLimit: 200000,
    sentAmount: 11760,
    status: 'review',
  },
  failed: {
    currency: 'FCFA',
    monthlyLimit: 200000,
    sentAmount: 11760,
    status: 'failed',
  },
  verified: {
    currency: 'FCFA',
    monthlyLimit: 10000000,
    sentAmount: 11760,
    status: 'verified',
  },
};

export const accountLimitProvider: AccountLimitProvider = {
  getAccountLimit: () => temporaryAccountLimits.unverified,
};

export function formatAccountLimitAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(amount).replace(/\u202f/g, ' ');
}