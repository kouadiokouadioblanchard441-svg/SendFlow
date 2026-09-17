const PIN_HASH_KEY = 'sendflow.pin.hash';

async function hashPin(pin: string) {
  const encodedPin = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', encodedPin);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function hasPin() {
  return Boolean(window.localStorage.getItem(PIN_HASH_KEY));
}

export async function savePin(pin: string) {
  window.localStorage.setItem(PIN_HASH_KEY, await hashPin(pin));
}

export async function verifyPin(pin: string) {
  const savedHash = window.localStorage.getItem(PIN_HASH_KEY);
  return savedHash !== null && savedHash === (await hashPin(pin));
}