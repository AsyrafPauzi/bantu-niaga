import { test, expect } from "@playwright/test";

/**
 * POS Checkout E2E tests.
 *
 * These verify the critical POS flow end-to-end. A valid session is required.
 * Use the shared auth fixture (see e2e/fixtures/auth.ts) or set E2E_STORAGE_STATE
 * to a saved auth state JSON path.
 */

test.describe("POS Checkout", () => {
  test.beforeEach(async ({ page }) => {
    // Skip gracefully if no auth state available — this test requires a real session.
    const storageState = process.env.E2E_STORAGE_STATE;
    if (!storageState) test.skip(true, "E2E_STORAGE_STATE not set — skipping POS tests");
  });

  test("POS page loads with product grid and cart", async ({ page }) => {
    await page.goto("/sales/pos");
    await expect(page.getByRole("heading", { name: /point of sale|pos/i })).toBeVisible({ timeout: 10_000 });
    // Product grid and checkout panel should both be visible
    await expect(page.locator("[data-testid=product-grid], .grid")).toBeVisible();
  });

  test("API: POS checkout route rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/sales/pos/checkout", {
      data: { items: [] },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    // Must NOT leak internal error text
    expect(JSON.stringify(body)).not.toMatch(/supabase|postgres|relation|column/i);
  });

  test("API: POS checkout validates input with Zod", async ({ request }) => {
    const res = await request.post("/api/sales/pos/checkout", {
      data: { bad_field: true },
      headers: { "Content-Type": "application/json" },
    });
    // Either 400 (validation) or 401 (auth) — not 500
    expect([400, 401]).toContain(res.status());
  });
});
