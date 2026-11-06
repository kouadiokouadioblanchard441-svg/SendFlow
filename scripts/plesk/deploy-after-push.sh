#!/usr/bin/env bash
set -euo pipefail

# Compatibility alias for Plesk actions configured with the former script name.
script_path="${BASH_SOURCE[0]}"
if [[ "$script_path" != /* ]]; then
  script_path="$PWD/$script_path"
fi
script_dir="${script_path%/*}"
source "$script_dir/build-after-pull.sh" "$@"
