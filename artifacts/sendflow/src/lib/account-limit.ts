export type AccountLimitStatus = 'unverified' | 'verified';

export type AccountLimitConfig = {
  currency: 'FCFA';
  monthlyLimit: number;
  sentAmount: number;
  status: AccountLimitStatus;
};

export interface AccountLimitProvider {
  getAccountLimit: () => AccountLimitConfig;
}

const temporaryAccountLimit: AccountLimitConfig = {
  currency: 'FCFA',
  monthlyLimit: 200000,
  sentAmount: 11760,
  status: 'unverified',
};

export const accountLimitProvider: AccountLimitProvider = {
  getAccountLimit: () => temporaryAccountLimit,
};

export function formatAccountLimitAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(amount).replace(/\u202f/g, ' ');
}