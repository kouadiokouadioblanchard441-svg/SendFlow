import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
await build({
  entryPoints: [fileURLToPath(new URL("server/start.ts", root))],
  outfile: fileURLToPath(new URL("dist/server/index.mjs", root)),
  bundle: true, platform: "node", format: "esm", external: ["pg-native"],
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
