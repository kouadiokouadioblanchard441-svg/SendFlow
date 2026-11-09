import { setBaseUrl } from '@workspace/api-client-react';

const apiBaseUrl =
  import.meta.env.VITE_API_URL?.trim() ||
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  null;

if (import.meta.env.MODE === 'capacitor') {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_URL must be set for the Android Capacitor build.');
  }

  let parsedApiUrl: URL;
  try {
    parsedApiUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error('VITE_API_URL must be an absolute HTTPS URL for Android.');
  }

  if (
    parsedApiUrl.protocol !== 'https:' ||
    ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsedApiUrl.hostname)
  ) {
    throw new Error('The Android Capacitor build requires a remote HTTPS API URL.');
  }
}

setBaseUrl(apiBaseUrl);
