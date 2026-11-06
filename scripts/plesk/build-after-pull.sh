#!/usr/bin/env bash
set -euo pipefail

script_path="${BASH_SOURCE[0]}"
if [[ "$script_path" != /* ]]; then
  script_path="$PWD/$script_path"
fi
script_dir="${script_path%/*}"
repo_root="$(cd -- "$script_dir/../.." && pwd -P)"
cd "$repo_root"

find_tool() {
  local tool="$1"
  local candidate
  candidate="$(command -v "$tool" 2>/dev/null || true)"
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi
  for candidate in "/usr/bin/$tool" "/bin/$tool"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

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
  "artifacts/api-server/plesk-runtime-dependencies.tar.gz"
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

TAR_BIN="$(find_tool tar)" || {
  echo "Plesk package activation requires tar; no build or Node.js installation is attempted here." >&2
  exit 1
}
GZIP_BIN="$(find_tool gzip)" || {
  echo "Plesk package activation requires gzip to unpack the committed API runtime archive." >&2
  exit 1
}
MKDIR_BIN="$(find_tool mkdir)" || { echo "Plesk package activation requires mkdir." >&2; exit 1; }
RM_BIN="$(find_tool rm)" || { echo "Plesk package activation requires rm." >&2; exit 1; }
MV_BIN="$(find_tool mv)" || { echo "Plesk package activation requires mv." >&2; exit 1; }

for tool_path in "$TAR_BIN" "$GZIP_BIN" "$MKDIR_BIN" "$RM_BIN" "$MV_BIN"; do
  tool_directory="${tool_path%/*}"
  case ":${PATH:-}:" in
    *":$tool_directory:"*) ;;
    *) PATH="${PATH:+$PATH:}$tool_directory" ;;
  esac
done
export PATH

api_root="$repo_root/artifacts/api-server"
runtime_archive="$api_root/plesk-runtime-dependencies.tar.gz"
runtime_stage="$api_root/.plesk-runtime-stage-$$"
runtime_previous="$api_root/.plesk-runtime-previous-$$"
cleanup_runtime_stage() {
  "$RM_BIN" -rf "$runtime_stage" "$runtime_previous"
}
trap cleanup_runtime_stage EXIT

archive_listing="$("$TAR_BIN" -tzf "$runtime_archive")" || {
  echo "Plesk API runtime archive is invalid or incomplete." >&2
  exit 1
}
while IFS= read -r archive_entry; do
  [[ -z "$archive_entry" ]] && continue
  if [[ "$archive_entry" == /* ||
        "$archive_entry" == ".." ||
        "$archive_entry" == ../* ||
        "$archive_entry" == */../* ||
        "$archive_entry" == */.. ||
        ( "$archive_entry" != "node_modules" && "$archive_entry" != node_modules/* ) ]]; then
    echo "Plesk API runtime archive contains an unsafe path." >&2
    exit 1
  fi
done <<< "$archive_listing"

"$RM_BIN" -rf "$runtime_stage" "$runtime_previous"
"$MKDIR_BIN" -p "$runtime_stage"
"$TAR_BIN" -xzf "$runtime_archive" -C "$runtime_stage"
if [[ ! -d "$runtime_stage/node_modules" ||
      ! -e "$runtime_stage/node_modules/sharp" ||
      ! -e "$runtime_stage/node_modules/@swc/helpers" ]]; then
  echo "Plesk API runtime archive is missing required external packages." >&2
  exit 1
fi

if [[ -e "$api_root/node_modules" || -L "$api_root/node_modules" ]]; then
  "$MV_BIN" "$api_root/node_modules" "$runtime_previous"
fi
if ! "$MV_BIN" "$runtime_stage/node_modules" "$api_root/node_modules"; then
  if [[ -e "$runtime_previous" || -L "$runtime_previous" ]]; then
    "$MV_BIN" "$runtime_previous" "$api_root/node_modules"
  fi
  echo "Could not activate the packaged API runtime dependencies." >&2
  exit 1
fi
"$RM_BIN" -rf "$runtime_previous"

printf 'Verified prebuilt SendFlow Plesk packages: site, API, and project-root startup file.\n'
printf 'Activated committed Linux x64 API runtime dependencies; no Node.js, pnpm, or build is run in the Plesk Git action.\n'
