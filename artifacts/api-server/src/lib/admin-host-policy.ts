export type AdminHostEnvironment = {
  NODE_ENV?: string;
  SENDFLOW_ADMIN_ALLOWED_HOSTS?: string;
};

function normalizeHost(value: string): string | null {
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.includes(",")
    || trimmed.includes("*")
    || /[/?#@\\\s]/u.test(trimmed)
  ) return null;
  try {
    const url = new URL(`https://${trimmed}`);
    if (
      url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
      || !url.hostname
    ) return null;
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

export function getAdminAllowedHosts(
  environment: AdminHostEnvironment = process.env,
): ReadonlySet<string> | null {
  const values = environment.SENDFLOW_ADMIN_ALLOWED_HOSTS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values?.length) return null;
  const hosts = values.map(normalizeHost);
  if (hosts.some((host) => host === null)) return null;
  return new Set(hosts as string[]);
}

export function isAdminHostAllowed(
  hostHeader: string | undefined,
  environment: AdminHostEnvironment = process.env,
): boolean {
  if (!hostHeader) return false;
  const host = normalizeHost(hostHeader);
  const allowedHosts = getAdminAllowedHosts(environment);
  return Boolean(host && allowedHosts?.has(host));
}
