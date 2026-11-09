function normalizeHost(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.includes("*") || candidate.includes("/") || candidate.includes("@")) return null;
  try {
    const parsed = new URL(`https://${candidate}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

export function isAdminHostAllowed(
  hostHeader: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const configured = environment.SENDFLOW_ADMIN_ALLOWED_HOSTS;
  if (!configured) return false;
  const entries = configured.split(",").map(normalizeHost);
  const requested = normalizeHost(hostHeader);
  return Boolean(requested && entries.length && entries.every(Boolean) && entries.includes(requested));
}
