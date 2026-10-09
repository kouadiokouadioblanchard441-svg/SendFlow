const MAX_TRUSTED_PROXY_HOPS = 16;

export function parseTrustProxyHops(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 1;
  if (!/^(0|[1-9]\d*)$/.test(value.trim())) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
  }

  const hops = Number(value);
  if (!Number.isSafeInteger(hops) || hops > MAX_TRUSTED_PROXY_HOPS) {
    throw new Error(`TRUST_PROXY_HOPS must be between 0 and ${MAX_TRUSTED_PROXY_HOPS}`);
  }
  return hops;
}
