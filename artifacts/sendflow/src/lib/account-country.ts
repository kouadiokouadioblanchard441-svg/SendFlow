export type AccountCountry = {
  countryCode?: string;
  name: string;
  dialCode: string;
  flag: string;
};

export const ACCOUNT_COUNTRY_KEY = 'sendflow.account.country';

export const DEFAULT_ACCOUNT_COUNTRY: AccountCountry = {
  countryCode: 'ci',
  name: 'Côte d’Ivoire',
  dialCode: '+225',
  flag: '🇨🇮',
};

export function saveAccountCountry(country: AccountCountry) {
  window.sessionStorage.setItem(ACCOUNT_COUNTRY_KEY, JSON.stringify(country));
}

export function readSavedAccountCountry(): AccountCountry | undefined {
  if (typeof window === 'undefined') return undefined;
  const storedCountry = window.sessionStorage.getItem(ACCOUNT_COUNTRY_KEY);
  if (!storedCountry) return undefined;

  try {
    const parsed = JSON.parse(storedCountry) as Partial<AccountCountry>;
    if (
      typeof parsed.countryCode === 'string' &&
      /^[a-z]{2}$/.test(parsed.countryCode) &&
      typeof parsed.name === 'string' &&
      typeof parsed.dialCode === 'string' &&
      typeof parsed.flag === 'string'
    ) {
      return {
        countryCode: parsed.countryCode,
        name: parsed.name,
        dialCode: parsed.dialCode,
        flag: parsed.flag,
      };
    }
  } catch {
    window.sessionStorage.removeItem(ACCOUNT_COUNTRY_KEY);
  }

  return undefined;
}

export function readAccountCountry(): AccountCountry {
  return readSavedAccountCountry() ?? DEFAULT_ACCOUNT_COUNTRY;
}