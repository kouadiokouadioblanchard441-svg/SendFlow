export const PHONE_DIGITS_BY_DIAL_CODE: Record<string, number> = {
  '+225': 10,
  '+228': 8,
  '+226': 8,
  '+237': 9,
  '+229': 10,
  '+223': 9,
  '+227': 9,
  '+221': 9,
};

export function getPhoneDigitsForCountry(dialCode: string): number | undefined {
  return PHONE_DIGITS_BY_DIAL_CODE[dialCode];
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidPhoneForCountry(
  value: string,
  dialCode: string,
  fallbackRange: { min: number; max: number } = { min: 7, max: 15 },
): boolean {
  const digits = normalizePhoneDigits(value);
  const expectedDigits = getPhoneDigitsForCountry(dialCode);

  if (expectedDigits) {
    return digits.length === expectedDigits;
  }

  return digits.length >= fallbackRange.min && digits.length <= fallbackRange.max;
}

export function getPhoneLengthMessage(
  dialCode: string,
  fallback = '8 à 10',
): string {
  const expectedDigits = getPhoneDigitsForCountry(dialCode);
  return expectedDigits
    ? `Saisissez un numéro de ${expectedDigits} chiffres.`
    : `Saisissez un numéro valide de ${fallback} chiffres.`;
}