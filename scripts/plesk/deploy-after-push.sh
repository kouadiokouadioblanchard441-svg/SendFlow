#!/usr/bin/env bash
set -euo pipefail

# Compatibility alias for any existing Plesk deployment action using the old name.
exec bash "$(dirname "$0")/build-after-pull.sh" "$@"
