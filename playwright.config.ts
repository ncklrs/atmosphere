import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:3210", trace: "retain-on-failure" },
  webServer: {
    command: "PORT=3210 WEB_ORIGIN=http://127.0.0.1:3210 pnpm start",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: false,
    timeout: 60000,
  },
  reporter: "list",
});
