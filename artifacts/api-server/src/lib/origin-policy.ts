export type OriginEnvironment = {
  NODE_ENV?: string;
  CORS_ALLOWED_ORIGINS?: string;
  REPLIT_DOMAINS?: string;
  REPLIT_DEV_DOMAIN?: string;
};

function normalizeConfiguredOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeHttpOrigin(value: string | undefined): string | null {
  if (!value) return null;
  return normalizeConfiguredOrigin(value);
}

export function getAllowedOrigins(
  environment: OriginEnvironment = process.env,
): Set<string> {
  const developmentOrigin = environment.REPLIT_DEV_DOMAIN
    ? normalizeConfiguredOrigin(environment.REPLIT_DEV_DOMAIN)
    : null;
  const configuredValues = [
    environment.CORS_ALLOWED_ORIGINS,
    environment.REPLIT_DOMAINS,
    environment.NODE_ENV === "production" ? undefined : environment.REPLIT_DEV_DOMAIN,
  ];

  const origins = configuredValues
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map(normalizeConfiguredOrigin)
    .filter((origin): origin is string => origin !== null);

  if (environment.NODE_ENV === "production") {
    return new Set(
      origins.filter(
        (origin) => origin.startsWith("https://") && origin !== developmentOrigin,
      ),
    );
  }
  return new Set(origins);
}

export function getTrustedHost(
  value: string | undefined,
  environment: OriginEnvironment = process.env,
): string | undefined {
  if (!value || value.includes(",") || /[/?#@]/.test(value)) return undefined;

  let host: string;
  try {
    const url = new URL(`https://${value.trim()}`);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    host = url.host.toLowerCase();
  } catch {
    return undefined;
  }

  const allowedHosts = new Set(
    [...getAllowedOrigins(environment)].map((origin) => new URL(origin).host.toLowerCase()),
  );
  return allowedHosts.has(host) ? host : undefined;
}

export function isAllowedRequestOrigin(
  originHeader: string | string[] | undefined,
  method: string,
  environment: OriginEnvironment = process.env,
): boolean {
  const normalizedMethod = method.toUpperCase();
  if (originHeader === undefined) {
    return normalizedMethod === "GET" || normalizedMethod === "HEAD";
  }
  if (Array.isArray(originHeader)) return false;

  const origin = normalizeHttpOrigin(originHeader);
  return origin !== null && getAllowedOrigins(environment).has(origin);
}
