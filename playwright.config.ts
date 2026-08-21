import { defineConfig, devices } from "@playwright/test";

/**
 * Bantu Niaga — Playwright E2E config.
 *
 * Tests run against the local dev server by default. In CI, set BASE_URL to
 * the preview deployment URL so tests run against a real environment.
 *
 * Usage:
 *   npx playwright test              — run all E2E tests
 *   npx playwright test --ui         — interactive UI mode
 *   npx playwright test e2e/auth.spec.ts  — single file
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 7"] } },
  ],

  // Start the dev server automatically when running locally.
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
