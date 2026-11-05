#!/usr/bin/env bash
set -euo pipefail

script_path="${BASH_SOURCE[0]}"
if [[ "$script_path" != /* ]]; then
  script_path="$PWD/$script_path"
fi
script_dir="${script_path%/*}"
repo_root="$(cd -- "$script_dir/../.." && pwd -P)"
cd "$repo_root"

if [[ ! -f package.json || ! -f pnpm-lock.yaml ]]; then
  echo "Plesk build must run from a complete SendFlow checkout." >&2
  exit 1
fi

node_version="$(node -p 'process.versions.node')"
if [[ "$node_version" != "24.22.2" ]]; then
  echo "Plesk build requires Node.js 24.22.2; found ${node_version}." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is unavailable in the Plesk environment." >&2
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
