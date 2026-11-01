import { getSafeApiErrorCopy, type SafeApiErrorCopy } from './safe-api-error';

type Listener = () => void;

let activeError: SafeApiErrorCopy | null = null;
let lastMessageKey = '';
let lastReportedAt = 0;
const listeners = new Set<Listener>();
const duplicateWindowMs = 1_500;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function reportGlobalErrorCopy(nextError: SafeApiErrorCopy) {
  if (activeError) return;

  const messageKey = `${nextError.title}\u0000${nextError.message}`;
  const now = Date.now();

  if (messageKey === lastMessageKey && now - lastReportedAt < duplicateWindowMs) return;

  lastMessageKey = messageKey;
  lastReportedAt = now;
  activeError = nextError;
  notifyListeners();
}

export function reportGlobalApiError(error: unknown) {
  reportGlobalErrorCopy(getSafeApiErrorCopy(error));
}

export function dismissGlobalApiError() {
  if (!activeError) return;
  activeError = null;
  notifyListeners();
}

export function getGlobalApiError() {
  return activeError;
}

export function subscribeToGlobalApiErrors(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
