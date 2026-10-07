const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CURSOR_LENGTH = 64;

export type CustomerTransactionCursorParse =
  | { valid: true; cursor: string | null }
  | { valid: false; cursor: null };

export function isValidCustomerTransactionId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function encodeCustomerTransactionCursor(
  transactionId: string,
): string {
  if (!isValidCustomerTransactionId(transactionId)) {
    throw new RangeError("Invalid transaction identifier for cursor");
  }
  return transactionId;
}

export function parseCustomerTransactionCursor(
  value: unknown,
): CustomerTransactionCursorParse {
  if (value === undefined) return { valid: true, cursor: null };
  if (typeof value !== "string" || value.length > MAX_CURSOR_LENGTH) {
    return { valid: false, cursor: null };
  }
  if (!isValidCustomerTransactionId(value)) return { valid: false, cursor: null };
  return { valid: true, cursor: value };
}
