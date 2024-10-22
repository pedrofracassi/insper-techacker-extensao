import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        setup: "src/setup/index.html",
        dashboard: "src/dashboard/index.html",
        login: "src/login/index.html",
        popup: "src/popup/index.html",
        addon: "src/addon/index.html",
        upload: "src/upload/index.html",
        offscreen: "src/offscreen/index.html",
      },
    },
  },
});
