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
  echo "Plesk deployment requires the complete SendFlow checkout." >&2
  exit 1
fi

required_files=(
  "index.cjs"
  "artifacts/dist/index.cjs"
  "artifacts/dist/server/index.mjs"
  "artifacts/dist/public/index.html"
  "artifacts/dist/plesk-manifest.json"
  "artifacts/api-server/dist/index.cjs"
  "artifacts/api-server/dist/index.mjs"
  "artifacts/api-server/dist/plesk-manifest.json"
)

missing=()
for file in "${required_files[@]}"; do
  if [[ ! -s "$file" ]]; then
    missing+=("$file")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Plesk deployment package is incomplete; missing required files:\n' >&2
  printf ' - %s\n' "${missing[@]}" >&2
  exit 1
fi

printf 'Verified prebuilt SendFlow Plesk packages: site, API, and project-root startup file.\n'
printf 'No build or dependency installation is run in the Plesk Git action.\n'
