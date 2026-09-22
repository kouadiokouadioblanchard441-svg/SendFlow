export const MAX_TRANSACTION_AMOUNT = 10_000_000;

export function parseWholeAmount(value: string): number {
  const normalized = value.replace(/\s/g, '');

  if (!/^\d+$/.test(normalized)) return 0;

  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : 0;
}

export function isValidTransactionAmount(amount: number): boolean {
  return Number.isSafeInteger(amount)
    && amount >= 1
    && amount <= MAX_TRANSACTION_AMOUNT;
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidIvoryCoastPhone(value: string): boolean {
  return /^0\d{9}$/.test(normalizePhoneDigits(value));
}

export function isValidInternationalPhone(value: string): boolean {
  const digits = normalizePhoneDigits(value);
  return /^\d{7,15}$/.test(digits);
}