import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // No module-preload polyfill: it would fetch same-origin, which the CSP (connect-src) does not allow.
  build: { outDir: "dist", sourcemap: false, modulePreload: { polyfill: false } },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
