type CountryPickerStatusInput = {
  catalogIsLoading: boolean;
  catalogIsError: boolean;
  registrationSettingsIsLoading: boolean;
  registrationSettingsIsError: boolean;
  defaultCountryUnavailable: boolean;
  countryCount: number;
};

export type CountryPickerStatus = {
  errorMessage?: string;
  isDisabled: boolean;
};

export function shouldLockSingleRegistrationCountry(
  registrationOnly: boolean,
  countryCount: number,
): boolean {
  return registrationOnly && countryCount === 1;
}

export function resolveCountryPickerStatus(
  input: CountryPickerStatusInput,
): CountryPickerStatus {
  if (input.catalogIsLoading || input.registrationSettingsIsLoading) {
    return { isDisabled: true };
  }

  let errorMessage: string | undefined;
  if (input.catalogIsError) {
    errorMessage = 'La liste des pays est temporairement indisponible.';
  } else if (input.registrationSettingsIsError) {
    errorMessage = 'Le pays par défaut est temporairement indisponible.';
  } else if (input.defaultCountryUnavailable) {
    errorMessage = 'Le pays par défaut est indisponible dans le catalogue.';
  } else if (input.countryCount === 0) {
    errorMessage = 'Aucun pays n’est disponible pour le moment.';
  }

  return {
    ...(errorMessage ? { errorMessage } : {}),
    isDisabled: Boolean(errorMessage) || input.countryCount === 0,
  };
}
