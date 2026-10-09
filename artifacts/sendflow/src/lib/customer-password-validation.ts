export const NEW_CUSTOMER_PASSWORD_MIN_LENGTH = 8;
export const LEGACY_CUSTOMER_PASSWORD_MIN_LENGTH = 4;
export const CUSTOMER_PASSWORD_MAX_LENGTH = 64;

export function validateCustomerPassword(
  password: string,
  minimumLength = NEW_CUSTOMER_PASSWORD_MIN_LENGTH,
) {
  if (!password) return 'Le code secret est requis.';
  if (password.length < minimumLength) {
    return `Le code secret doit contenir au moins ${minimumLength} caractères.`;
  }
  if (password.length > CUSTOMER_PASSWORD_MAX_LENGTH) {
    return `Le code secret ne peut pas dépasser ${CUSTOMER_PASSWORD_MAX_LENGTH} caractères.`;
  }
  return undefined;
}
