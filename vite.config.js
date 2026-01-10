import preact from "@preact/preset-vite";
import { createRequire } from "module";
import { defineConfig } from "vite";
import packageJson from "./package.json" with { type: "json" };

// https://vite.dev/config/
export default defineConfig({
  define: {
    APP_VERSION: JSON.stringify(packageJson.version),
  },
  plugins: [
    preact({
      babel: {
        // Change cwd to load Preact Babel plugins
        cwd: createRequire(import.meta.url).resolve("@preact/preset-vite"),
      },
    }),
  ],
});
