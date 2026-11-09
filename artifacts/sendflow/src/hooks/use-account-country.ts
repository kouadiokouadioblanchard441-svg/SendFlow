import { useGetAuthCountries, getGetAuthCountriesQueryKey, useGetRegistrationSettings, getGetRegistrationSettingsQueryKey } from '@workspace/api-client-react';
import { getConfiguredDefaultAccountCountry, readSavedAccountCountry, type AccountCountry } from '@/lib/account-country';

const unavailableCountry: AccountCountry = {
  name: '',
  dialCode: '',
  flag: '',
};

export function useAccountCountry() {
  const countryCatalog = useGetAuthCountries({
    query: {
      queryKey: getGetAuthCountriesQueryKey(),
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  });
  const registrationSettings = useGetRegistrationSettings({
    query: {
      queryKey: getGetRegistrationSettingsQueryKey(),
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  });

  const saved = readSavedAccountCountry();
  const configuredCountry: AccountCountry | undefined = countryCatalog.data && registrationSettings.data
    ? getConfiguredDefaultAccountCountry(
      countryCatalog.data.countries,
      registrationSettings.data.defaultCountryCode,
    )
    : undefined;

  return {
    country: saved ?? configuredCountry ?? unavailableCountry,
    isReady: Boolean(saved || configuredCountry),
    isError: countryCatalog.isError || registrationSettings.isError,
  };
}
