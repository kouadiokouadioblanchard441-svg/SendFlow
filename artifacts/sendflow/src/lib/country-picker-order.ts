type CountryPickerEntry = {
  countryCode: string;
  name: string;
};

export function orderCountriesWithDefaultFirst<T extends CountryPickerEntry>(
  countries: readonly T[],
  defaultCountryCode: string,
): T[] {
  const normalizedDefault = defaultCountryCode.toLowerCase();
  return [...countries].sort((left, right) => {
    const leftIsDefault = left.countryCode.toLowerCase() === normalizedDefault;
    const rightIsDefault = right.countryCode.toLowerCase() === normalizedDefault;
    if (leftIsDefault !== rightIsDefault) return leftIsDefault ? -1 : 1;
    return left.name.localeCompare(right.name, 'fr-FR');
  });
}
