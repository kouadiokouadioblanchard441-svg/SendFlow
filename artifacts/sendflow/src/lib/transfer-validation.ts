import { getPhoneDigitsForCountry, isValidPhoneForCountry, normalizePhoneDigits } from '@/lib/phone-rules';

export function parseWholeAmount(value: string): number {
  const normalized = value.replace(/\s/g, '');

  if (!/^\d+$/.test(normalized)) return 0;

  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : 0;
}

export function isValidTransactionAmount(amount: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(amount)
    && Number.isSafeInteger(minimum)
    && Number.isSafeInteger(maximum)
    && amount >= minimum
    && amount <= maximum;
}

export function isValidIvoryCoastPhone(value: string): boolean {
  return /^0\d{9}$/.test(normalizePhoneDigits(value));
}

export function isValidInternationalPhone(value: string, dialCode?: string): boolean {
  if (dialCode) {
    return isValidPhoneForCountry(value, dialCode);
  }

  const digits = normalizePhoneDigits(value);
  return /^\d{7,15}$/.test(digits);
}

export { getPhoneDigitsForCountry };