import { defineConfig } from "@playwright/test";
const preview = process.env.E2E_PREVIEW === "1";
const baseURL = `http://127.0.0.1:${preview ? "4173" : "5173"}${process.env.E2E_BASE_PATH || "/"}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 3,
  use: { baseURL, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: {
    command: `node node_modules/vite/bin/vite.js ${preview ? "preview " : ""}--host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "phone", use: { viewport: { width: 375, height: 812 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
