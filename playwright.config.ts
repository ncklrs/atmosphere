import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 2,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:3212", trace: "retain-on-failure" },
  webServer: {
    command:
      "ROOM_OWNER=1 WIIM_HOST= LYRICS_PROVIDER= GATEWAY_PORT=8788 PORT=3212 WEB_ORIGIN=http://127.0.0.1:3212 pnpm start",
    url: "http://127.0.0.1:3212",
    reuseExistingServer: false,
    timeout: 60000,
  },
  // Room integration mutates shared server state; run it after isolated browser flows.
  projects: [
    { name: "browser", testIgnore: /z-room\.spec\.ts/ },
    { name: "room", testMatch: /z-room\.spec\.ts/, dependencies: ["browser"] },
  ],
  reporter: "list",
});
