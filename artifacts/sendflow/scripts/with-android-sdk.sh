#!/usr/bin/env bash
# Resolve the pinned SDK from Nix before invoking any Android tooling.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$(cd -- "$script_dir/.." && pwd)"
workspace_dir="$(cd -- "$script_dir/../../.." && pwd)"

if [[ $# -eq 0 ]]; then
  echo "Usage: with-android-sdk.sh <Gradle task...> | --cap-open" >&2
  exit 2
fi

sdk_output="$(nix-build "$workspace_dir/android-sdk.nix" --no-out-link)"
export ANDROID_HOME="$sdk_output/libexec/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# Resolve the pinned JDK package from the same Nix channel instead of relying on PATH order.
export JAVA_HOME
JAVA_HOME="$(nix eval --impure --raw --expr 'toString (import <nixpkgs> {}).jdk21')"
export PATH="$JAVA_HOME/bin:$PATH"

if [[ ! -x "$JAVA_HOME/bin/java" || ! -d "$ANDROID_HOME/platforms/android-36" ]]; then
  echo "The pinned JDK 21 or Android API 36 SDK is unavailable." >&2
  exit 1
fi

if [[ "${1:-}" == "--cap-open" ]]; then
  shift
  cd "$app_dir"
  exec pnpm exec cap open android "$@"
fi

cd "$app_dir/android"
exec ./gradlew "$@"
