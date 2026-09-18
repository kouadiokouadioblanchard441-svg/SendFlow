export type AccountCountry = {
  name: string;
  dialCode: string;
  flag: string;
};

export const ACCOUNT_COUNTRY_KEY = 'sendflow.account.country';

export const DEFAULT_ACCOUNT_COUNTRY: AccountCountry = {
  name: 'Côte d’Ivoire',
  dialCode: '+225',
  flag: '🇨🇮',
};

export function saveAccountCountry(country: AccountCountry) {
  window.sessionStorage.setItem(ACCOUNT_COUNTRY_KEY, JSON.stringify(country));
}

export function readAccountCountry(): AccountCountry {
  const storedCountry = window.sessionStorage.getItem(ACCOUNT_COUNTRY_KEY);
  if (!storedCountry) return DEFAULT_ACCOUNT_COUNTRY;

  try {
    const parsed = JSON.parse(storedCountry) as Partial<AccountCountry>;
    if (
      typeof parsed.name === 'string' &&
      typeof parsed.dialCode === 'string' &&
      typeof parsed.flag === 'string'
    ) {
      return {
        name: parsed.name,
        dialCode: parsed.dialCode,
        flag: parsed.flag,
      };
    }
  } catch {
    window.sessionStorage.removeItem(ACCOUNT_COUNTRY_KEY);
  }

  return DEFAULT_ACCOUNT_COUNTRY;
}