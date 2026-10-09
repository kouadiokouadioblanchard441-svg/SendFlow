import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "africa.sendflow.app",
  appName: "SendFlow",
  // Bundle local web assets; no live-reload or remote server.url is configured.
  webDir: "dist/public",
  loggingBehavior: "debug",
  android: {
    // API and authentication use HTTPS requests; no external page is trusted in the WebView.
    allowNavigation: [],
    allowMixedContent: false,
    // The standard WebView keyboard handles financial forms; no custom key capture is needed.
    captureInput: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
