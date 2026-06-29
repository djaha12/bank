import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Assumes the app is running (npm run dev) and the DB is
 * seeded. Run: npm run test:e2e. CI should start the server + seed first.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: process.env.APP_URL ?? "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
