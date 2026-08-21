import { test, expect } from "@playwright/test";

/**
 * Auth flow E2E tests.
 *
 * These tests hit real pages. Credentials come from environment variables:
 *   E2E_EMAIL=test@example.com
 *   E2E_PASSWORD=testpassword
 *
 * Set these in .env.local (never commit real credentials).
 */

const email = process.env.E2E_EMAIL ?? "e2e@bantuniaga.local";
const password = process.env.E2E_PASSWORD ?? "e2e-password-123";

test.describe("Authentication", () => {
  test("unauthenticated visitor is redirected to /sign-in", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-in page renders correctly", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("wrong-password-xyz");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should stay on sign-in and show an error
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator("[role=alert], [data-testid=error]").first()).toBeVisible({ timeout: 8000 });
  });

  test("successful sign-in redirects to /home", async ({ page }) => {
    test.skip(!process.env.E2E_EMAIL, "E2E_EMAIL not set — skipping live login test");
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(home|dashboard)/, { timeout: 15_000 });
  });
});
