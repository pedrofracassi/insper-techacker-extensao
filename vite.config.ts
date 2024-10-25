import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import zipPack from "vite-plugin-zip-pack";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest }), zipPack()],
  build: {
    rollupOptions: {
      input: "index.html",
    },
  },
});
