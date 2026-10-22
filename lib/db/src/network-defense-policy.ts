export const NETWORK_DEFENSE_POLICY = Object.freeze({
  requestsPerMinute: 1200,
  probesPerTenMinutes: 5,
  automaticBlocksPermanent: true,
});

/** Only known reconnaissance targets, not an arbitrary 404 or a cloud ASN.
 * Never read query values, credentials, request bodies or User-Agent as evidence.
 */
export function classifyNetworkRequest(rawUrl: string | undefined): "probe" | "normal" {
  let path = (rawUrl ?? "/").split("?")[0].slice(0, 4096);
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    } catch { break; }
  }
  path = path.replace(/\\/g, "/").toLowerCase();
  if (/(?:^|\/)\.(?:env(?:[./]|$)|git(?:\/|$)|svn(?:\/|$))/.test(path)
    || /(?:^|\/)(?:wp-login\.php|xmlrpc\.php|phpinfo\.php)(?:\/|$)/.test(path)
    || /(?:^|\/)(?:wp-admin|phpmyadmin|pma)(?:\/|$)/.test(path)
    || /\/(?:actuator\/(?:env|heapdump)|vendor\/phpunit\/|cgi-bin\/.*(?:\/bin\/|\.sh))/.test(path)
    || /(?:^|\/)\.\.(?:\/|$)/.test(path)) return "probe";
  return "normal";
}
