export type AccountCountry = {
  countryCode?: string;
  name: string;
  dialCode: string;
  flag: string;
};

export type AccountCountryCatalogEntry = {
  countryCode: string;
  countryName: string;
  phonePrefix: string;
  flag: string;
};

export const ACCOUNT_COUNTRY_KEY = 'sendflow.account.country';

export function getConfiguredDefaultAccountCountry(
  countries: readonly AccountCountryCatalogEntry[],
  defaultCountryCode: string,
): AccountCountry | undefined {
  const configured = countries.find(
    (country) => country.countryCode.toLowerCase() === defaultCountryCode.toLowerCase(),
  );
  if (!configured) return undefined;
  return {
    countryCode: configured.countryCode,
    name: configured.countryName,
    dialCode: configured.phonePrefix,
    flag: configured.flag,
  };
}

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
