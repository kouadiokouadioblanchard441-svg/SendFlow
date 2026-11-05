#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Plesk build requires the main branch." >&2
  exit 1
fi

node_version="$(node -p 'process.versions.node')"
if [[ "$node_version" != "24.22.2" ]]; then
  echo "Plesk SSH shell must use Node.js 24.22.2; found ${node_version}." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is unavailable in the Plesk SSH environment." >&2
  exit 1
fi

pnpm_version="$(pnpm --version)"
if [[ "$pnpm_version" != "10.26.1" ]]; then
  echo "SendFlow requires pnpm 10.26.1; found ${pnpm_version}." >&2
  echo "Use the packageManager version declared in package.json, then retry." >&2
  exit 1
fi

pnpm install --frozen-lockfile
pnpm run build:plesk
