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

node_bin="${NODE_BINARY:-$(command -v node || true)}"
if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
  echo "Node.js is unavailable to the Plesk deployment action. Expose the selected Node binary in PATH or set NODE_BINARY to its executable path." >&2
  exit 1
fi

if ! node_version="$("$node_bin" -p 'process.versions.node' 2>/dev/null)"; then
  echo "The configured Node.js executable could not be run." >&2
  exit 1
fi
if [[ "$node_version" != "24.22.2" ]]; then
  echo "Plesk build requires Node.js 24.22.2; found ${node_version}." >&2
  exit 1
fi

pnpm_bin="${PNPM_BINARY:-$(command -v pnpm || true)}"
if [[ -z "$pnpm_bin" || ! -x "$pnpm_bin" ]]; then
  echo "pnpm is unavailable to the Plesk deployment action. Expose it in PATH or set PNPM_BINARY to its executable path." >&2
  exit 1
fi

if ! pnpm_version="$("$pnpm_bin" --version 2>/dev/null)"; then
  echo "The configured pnpm executable could not be run." >&2
  exit 1
fi
if [[ "$pnpm_version" != "10.26.1" ]]; then
  echo "SendFlow requires pnpm 10.26.1; found ${pnpm_version}." >&2
  echo "Use the packageManager version declared in package.json, then retry." >&2
  exit 1
fi

"$pnpm_bin" install --frozen-lockfile
"$pnpm_bin" run build:plesk
