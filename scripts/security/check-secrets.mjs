import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['provider-key', /\b(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|esms_(?:test|live)_[A-Za-z0-9._~-]{16,}|AKIA[A-Z0-9]{16}|AIza[\w-]{30,}|gh[pousr]_[A-Za-z0-9]{30,})\b/],
  ['credential-url', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|https?):\/\/[^\s/:]+:[^\s@]+@/],
  ['jwt-literal', /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{16,}\b/],
  ['public-secret-variable', /(?:VITE_|NEXT_PUBLIC_|EXPO_PUBLIC_)[A-Z_]*(?:SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|API_KEY|ACCESS_TOKEN)/],
];

const literalCredential = /(?:^|[\s{;,])["']?(?:DIDIT_API_KEY|DIDIT_WEBHOOK_SECRET|ESMS_API_KEY|SESSION_SECRET|CUSTOMER_PII_ENCRYPTION_KEY|NEON_DATABASE_URL_PRODUCTION|SENDFLOW_ADMIN_PIN|apiKey|clientSecret|sessionSecret|privateKey|password|passwd)["']?\s*[:=]\s*["']([^"'\n]{4,})["']/;
const publicEnvAllowlist = new Set(['VITE_API_URL', 'VITE_API_BASE_URL', 'VITE_PUBLIC_SITE_URL']);

export function scanText(file, text) {
  const findings = [];
  const isTest = /(?:\.test\.|\/tests\/)/.test(file);
  // Synthetic credential fixtures belong only in isolated test files.
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    for (const [rule, pattern] of patterns) {
      // The regression suite constructs malicious inputs in memory.
      if (rule === 'public-secret-variable' && isTest) continue;
      if (pattern.test(line)) findings.push({ file, line: index + 1, rule });
    }
    const literal = line.match(literalCredential);
    const isEnvironmentPlaceholder = literal && /^\$(?:\{[A-Z][A-Z0-9_]*\}|[A-Z][A-Z0-9_]*)$/.test(literal[1]);
    if (!isTest && literal && !isEnvironmentPlaceholder) {
      findings.push({ file, line: index + 1, rule: 'literal-credential' });
    }
    if (/(?:^|\/)\.env[^/]*$/.test(file)) {
      const assignment = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (assignment && !publicEnvAllowlist.has(assignment[1]) && !file.endsWith('.env.example')) {
        findings.push({ file, line: index + 1, rule: 'tracked-private-environment' });
      }
    }
    if (/^(?:artifacts\/(?:sendflow|mockup-sandbox)\/src|lib\/api-client-react\/src)\//.test(file) &&
        !isTest && /\bprocess\.env\b|from\s+["'][^"']*(?:api-server|@workspace\/db|\/db\/src)/.test(line)) {
      findings.push({ file, line: index + 1, rule: 'client-server-boundary' });
    }
  }
  return findings;
}

export function checkRepository() {
  // Git supplies paths, never environment values. Ignored local secrets are not read.
  const files = [...new Set(execFileSync('git', [
    'ls-files', '--cached', '--others', '--exclude-standard', '-z',
  ], { encoding: 'utf8' }).split('\0').filter(Boolean))];
  const findings = [];
  let inspected = 0;
  for (const file of files) {
    if (file.endsWith('pnpm-lock.yaml') || /\.(?:svg|map)$/.test(file)) continue;
    let raw;
    try { raw = readFileSync(file); } catch (error) {
      if (error.code === 'ENOENT') continue; // Locally deleted tracked file.
      throw error;
    }
    if (raw.includes(0)) continue;
    const text = new TextDecoder('utf-8', { fatal: false }).decode(raw);
    if (text.includes('\uFFFD')) continue;
    inspected++;
    findings.push(...scanText(file, text));
  }
  return { inspected, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { inspected, findings } = checkRepository();
    for (const finding of findings) {
      // Never echo matches, source lines, URLs, tokens, or credential values.
      console.error(`${finding.file}:${finding.line} [${finding.rule}] (value hidden)`);
    }
    console.log(`Secret-boundary check: ${inspected} text files, ${findings.length} finding(s).`);
    process.exitCode = findings.length ? 1 : 0;
  } catch {
    console.error('Secret-boundary check could not inspect the repository.');
    process.exitCode = 2;
  }
}
