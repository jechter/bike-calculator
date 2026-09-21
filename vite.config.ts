import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built site works when served from any subpath
// (e.g. GitHub Pages project sites or a file opened on a shop machine).
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
  },
});
