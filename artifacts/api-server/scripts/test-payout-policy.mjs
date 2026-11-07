import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const apiDir = process.cwd();
const outputDir = mkdtempSync(join(tmpdir(), "sendflow-payout-tests-"));
const inputs = [
  ["payout-policy", "src/services/payout-policy.test.mjs"],
  ["payout-webhook-payload", "src/lib/payout-webhook-payload.test.mjs"],
];
try {
  const compiled = [];
  for (const [name, path] of inputs) {
    const outfile = join(outputDir, `${name}.mjs`);
    await build({
      entryPoints: [resolve(apiDir, path)],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node24",
      packages: "external",
      logLevel: "silent",
    });
    compiled.push(outfile);
  }
  const result = spawnSync(process.execPath, ["--test", ...compiled], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
