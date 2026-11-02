// Only explicitly public routing metadata and the Cloudflare site key belong
// in a browser or Android JavaScript bundle. Verification secrets are excluded.
const publicNames = [
  'VITE_API_URL',
  'VITE_API_BASE_URL',
  'VITE_PUBLIC_SITE_URL',
  'VITE_TURNSTILE_SITE_KEY',
];
const turnstileSiteKeyPattern = /^[A-Za-z0-9_-]{1,128}$/;

export function publicClientDefinitions(environment) {
  const definitions = {};
  for (const name of publicNames) {
    const value = environment[name]?.trim() ?? '';
    if (name === 'VITE_TURNSTILE_SITE_KEY') {
      if (value && !turnstileSiteKeyPattern.test(value)) {
        throw new Error(`${name} must contain only public site-key characters`);
      }
      definitions[`import.meta.env.${name}`] = JSON.stringify(value);
      continue;
    }
    if (value) {
      let url;
      try {
        // Relative API prefixes are supported; protocol-relative URLs are not.
        if (value.startsWith('//') || value.includes('\\')) throw new Error();
        url = new URL(value, 'https://public-url-validation.invalid');
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username || url.password || url.search || url.hash ||
          (!value.startsWith('/') && !/^https?:\/\//i.test(value)) ||
          (name === 'VITE_PUBLIC_SITE_URL' && value.startsWith('/'))
        ) throw new Error();
      } catch {
        // Never include the supplied URL: it may contain an accidentally pasted secret.
        throw new Error(`${name} must be a public HTTP(S) URL or API path without credentials, query or fragment`);
      }
    }
    definitions[`import.meta.env.${name}`] = JSON.stringify(value);
  }
  return definitions;
}
