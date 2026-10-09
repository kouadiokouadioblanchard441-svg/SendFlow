#!/usr/bin/env bash
# Decode the upload key only into a private temporary directory and remove it on exit.
set -euo pipefail

: "${ANDROID_KEYSTORE_BASE64:?Add the base64-encoded upload keystore as Replit Secret ANDROID_KEYSTORE_BASE64}"
: "${ANDROID_KEYSTORE_PASSWORD:?Add ANDROID_KEYSTORE_PASSWORD as a Replit Secret}"
: "${ANDROID_KEY_ALIAS:?Add ANDROID_KEY_ALIAS as a Replit Secret}"
: "${ANDROID_KEY_PASSWORD:?Add ANDROID_KEY_PASSWORD as a Replit Secret}"

umask 077
signing_dir="$(mktemp -d "${TMPDIR:-/tmp}/sendflow-android-signing.XXXXXX")"
trap 'rm -rf "$signing_dir"' EXIT

keystore_file="$signing_dir/sendflow-upload-key.jks"
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore_file"
chmod 600 "$keystore_file"

# Gradle receives only the temporary path and passwords, not the base64 key material.
unset ANDROID_KEYSTORE_BASE64
export ANDROID_KEYSTORE_PATH="$keystore_file"
export ANDROID_SIGN_RELEASE=true

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "$script_dir/with-android-sdk.sh" bundleRelease
