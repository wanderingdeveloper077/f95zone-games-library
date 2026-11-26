import fs from "node:fs";
import { defineConfig } from "wxt";

const extensionPkg = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version?: string };
const EXTENSION_VERSION = extensionPkg.version || "1.0.0";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox";
    return {
      name: "Game Library Manager Companion",
      short_name: "GameLibrary",
      description:
        "Sync F95zone cookies and library badges securely with your local Game Library Manager.",
      version: EXTENSION_VERSION,
      permissions: [
        "cookies",
        "storage",
        "activeTab",
        "contextMenus",
        "scripting",
        "alarms",
      ],
      host_permissions: ["*://*.f95zone.to/*", "http://127.0.0.1/*"],
      icons: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "128": "icon/128.png",
      },
      ...(isFirefox
        ? {
            browser_specific_settings: {
              gecko: {
                id: "game-library-manager@local",
                strict_min_version: "109.0",
              },
            },
          }
        : {}),
    };
  },
});
