import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  optimizeDeps: {
    entries: ["index.html"],
    exclude: ["playwright-report", "test-results", "edge-debug-profile", "preview-root"]
  },
  server: {
    port: 5173,
    watch: {
      ignored: [
        "**/edge-debug-profile/**",
        "**/preview-root/**",
        "**/dist/**",
        "**/*.log",
        "**/*.tsbuildinfo"
      ]
    }
  }
});
