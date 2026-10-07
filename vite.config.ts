import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// configure-pages supplies /android-lab/ in CI; local development stays at /.
const base = process.env.PAGES_BASE_PATH || "/";
if (!base.startsWith("/") || !base.endsWith("/") || base.startsWith("//")) {
  throw new Error("PAGES_BASE_PATH must be an absolute path ending in /.");
}

export default defineConfig({
  base,
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: { outDir: "dist", sourcemap: false },
});
