import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";
const { version } = packageJson;

// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = "0"] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, "")
  // split into version parts
  .split(/[.-]/);

export default defineManifest(async (env) => ({
  manifest_version: 3,
  name: `Extensão TecHacker${env.mode ? ` (${env.mode})` : ""}`,
  // up to four numbers separated by dots
  version: `${major}.${minor}.${patch}.${label}`,
  // semver is OK in "version_name"
  version_name: version,
  background: {
    service_worker: "src/background.ts",
  },
  action: { default_popup: "index.html" },
  content_scripts: [
    {
      js: ["src/content.tsx"],
      matches: ["<all_urls>"],
      run_at: "document_start",
    },
  ],
  host_permissions: ["<all_urls>"],
  permissions: [
    "activeTab",
    "storage",
    "cookies",
    "webRequest",
    "webRequestBlocking",
    "<all_urls>",
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
  ],
}));
