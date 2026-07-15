import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@scoutpass/backend/contracts",
        replacement: fileURLToPath(new URL("../backend/src/contracts/index.ts", import.meta.url))
      },
      {
        find: "@scoutpass/backend/runtime",
        replacement: fileURLToPath(new URL("../backend/src/runtime/index.ts", import.meta.url))
      },
      {
        find: "@scoutpass/backend/sharing",
        replacement: fileURLToPath(new URL("../backend/src/sharing.ts", import.meta.url))
      }
    ]
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
