import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "africa.sendflow.app",
  appName: "SendFlow",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
