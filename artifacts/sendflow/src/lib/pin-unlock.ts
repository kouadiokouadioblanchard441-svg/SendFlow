const PIN_UNLOCK_KEY = 'sendflow.pin.unlocked';
const PIN_UNLOCK_EXPIRY_KEY = 'sendflow.pin.unlocked-until';
// Relock slightly before the server's 15-minute deadline to account for response latency.
const PIN_UNLOCK_DURATION_MS = 15 * 60 * 1000 - 5 * 1000;

export function clearPinUnlock() {
  window.sessionStorage.removeItem(PIN_UNLOCK_KEY);
  window.sessionStorage.removeItem(PIN_UNLOCK_EXPIRY_KEY);
}

export function markPinUnlocked(now = Date.now()) {
  window.sessionStorage.setItem(PIN_UNLOCK_EXPIRY_KEY, String(now + PIN_UNLOCK_DURATION_MS));
  window.sessionStorage.setItem(PIN_UNLOCK_KEY, 'true');
}

export function getPinUnlockExpiry(now = Date.now()): number | null {
  const expiry = Number(window.sessionStorage.getItem(PIN_UNLOCK_EXPIRY_KEY));
  if (
    window.sessionStorage.getItem(PIN_UNLOCK_KEY) !== 'true'
    || !Number.isFinite(expiry)
    || expiry <= now
    || expiry > now + PIN_UNLOCK_DURATION_MS
  ) {
    clearPinUnlock();
    return null;
  }
  return expiry;
}