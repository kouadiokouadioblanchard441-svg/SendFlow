# SendFlow Android release guide

This guide prepares a Google Play upload bundle without changing SendFlow's financial logic. The backend remains the authority for balances, transfer validation, OTP validation, and provider operations.

## Current build configuration

- Capacitor packages the local Vite output from `artifacts/sendflow/dist/public`; no remote `server.url` or live-reload origin is configured.
- Capacitor mode reads the public API origin from the workspace-root `.env.capacitor`. It must remain an HTTPS origin. Local web previews do not inherit this production origin.
- `VITE_CLERK_PUBLISHABLE_KEY` is a public Clerk key used by the admin-only Clerk UI. Customer authentication remains server-owned OTP. The current preview reports development Clerk keys; use the production publishable key from Replit Secrets for a production release. Never put Clerk secret keys in a `VITE_*` variable.
- Stripe is not currently used by the SendFlow client, so no Stripe key is configured.
- Android uses minimum SDK 24 and target/compile SDK 36. SDK 36 is retained rather than downgrading to the lower values in the original request.
- The Android Gradle Wrapper is pinned by `android/gradle/wrapper/gradle-wrapper.properties`; a separately installed global Gradle is not needed.
- Release builds enable R8 minification and resource shrinking. Since the release build is intentionally not run during this configuration pass, validate those optimizations on a test device before publishing.
- Release signing is opt-in. `build:android:release` creates an unsigned AAB; `build:android:release:signed` requires the signing secrets described below.

## Build environment

The project pins JDK 21 in `.replit` and declares the Android SDK composition in the workspace-root `android-sdk.nix`. That expression pins API 36 and Build Tools 35.0.0/36.0.0, excludes emulator images and unused native toolchains, and records the explicitly authorized Android SDK license acceptance. Android commands resolve this composition through Nix before invoking Gradle, so the SDK is reproducible after a Repl restart or fresh environment.

`ANDROID_HOME` and `ANDROID_SDK_ROOT` are set by the Android command wrapper from the resolved Nix output rather than hard-coded to one Nix store path. The wrapper also resolves JDK 21 from the pinned Nix channel. Do not copy Android SDK license files into the repository.

## Generate and protect the upload keystore

Use a trusted local machine. Keep an offline backup of the upload keystore and passwords; losing the upload key can delay future Play Store updates. For new Play apps, enable Play App Signing and use this key as the upload key.

```bash
keytool -genkeypair -v \
  -keystore sendflow-upload-key.jks \
  -storetype JKS \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -alias sendflow-upload
```

Enter passwords interactively; do not put them in shell arguments or commit them. Encode the keystore for the Replit Secrets interface:

```bash
base64 -w 0 sendflow-upload-key.jks > /tmp/sendflow-upload-key.b64
chmod 600 /tmp/sendflow-upload-key.b64
```

Add these values through the Replit Secrets interface, never through chat or a committed `.env` file:

- `ANDROID_KEYSTORE_BASE64` — contents of `/tmp/sendflow-upload-key.b64`
- `ANDROID_KEYSTORE_PASSWORD` — keystore password
- `ANDROID_KEY_ALIAS` — `sendflow-upload` (or the alias you chose)
- `ANDROID_KEY_PASSWORD` — key password

Remove the temporary encoded file after adding the secret:

```bash
rm -f /tmp/sendflow-upload-key.b64
```

The signed-build helper decodes the keystore into a mode-600 temporary file outside the repository and removes that directory when the build process exits.

## Build commands

From the workspace root:

```bash
# Debug APK
pnpm --filter @workspace/sendflow run build:android

# Unsigned release AAB; useful for checking the release configuration only
pnpm --filter @workspace/sendflow run build:android:release

# Signed production upload AAB; requires all four Replit Secrets above
pnpm --filter @workspace/sendflow run build:android:release:signed
```

The signed script resolves the pinned SDK, then runs the Gradle Wrapper command `./gradlew bundleRelease` from `artifacts/sendflow/android`, with signing enabled only for that invocation. The resulting bundle is:

```text
artifacts/sendflow/android/app/build/outputs/bundle/release/app-release.aab
```

Do not upload an unsigned bundle. Before a public release, install and test the signed release build, verify OTP/session behavior and financial flows against an approved test environment, complete Google Play's app-content/data-safety declarations, and review the Play Console target-API requirement for the submission date.

## Navigation and deep links

The current customer flow uses server-owned OTP and has no OAuth callback or external payment return that needs a deep link. No custom deep-link intent filter is added. `android.allowNavigation` stays empty: Capacitor documents that allowlisting additional in-WebView navigation is not intended for production, and it does not control API `fetch` requests. API access is instead restricted to HTTPS by the app build check, Android cleartext setting, and backend CORS policy. If a future provider introduces a callback, define the exact HTTPS app-link domain and verify Android App Links before adding an intent filter.
