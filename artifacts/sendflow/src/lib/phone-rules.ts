export function getPhoneDigitsForCountry(
  _dialCode: string,
  rules?: { minPhoneDigits: number; maxPhoneDigits: number },
): number | undefined {
  return rules && rules.minPhoneDigits === rules.maxPhoneDigits ? rules.maxPhoneDigits : undefined;
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidPhoneForCountry(
  value: string,
  dialCode: string,
  rules?: { min: number; max: number },
): boolean {
  const digits = normalizePhoneDigits(value);
  const fullPhone = `${dialCode}${digits}`;
  return /^\+[1-9][0-9]{7,14}$/.test(fullPhone)
    && (!rules || (digits.length >= rules.min && digits.length <= rules.max));
}

export function getPhoneLengthMessage(
  _dialCode: string,
  _fallback?: string,
): string {
  return 'Saisissez un numéro de téléphone valide pour le pays sélectionné.';
}