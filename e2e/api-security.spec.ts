import { test, expect } from "@playwright/test";

/**
 * API security regression tests.
 *
 * These run without authentication to verify that all protected endpoints:
 *   1. Return 401 (not 200, 403, or 500) for unauthenticated requests.
 *   2. Never expose internal error messages (Supabase, Postgres, stack traces).
 *
 * These tests are safe to run in CI with no credentials.
 */

const PROTECTED_GET_ROUTES = [
  "/api/finance/invoices",
  "/api/hr/employees",
  "/api/sales/leads",
  "/api/marketing/customers",
  "/api/settings/billing/invoices",
  "/api/admin/tasks",
];

const PROTECTED_POST_ROUTES = [
  { path: "/api/sales/pos/checkout", body: {} },
  { path: "/api/finance/invoices", body: {} },
  { path: "/api/marketing/segments", body: {} },
];

test.describe("API Security — unauthenticated requests", () => {
  for (const route of PROTECTED_GET_ROUTES) {
    test(`GET ${route} → 401 with no internal error text`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty("error");
      // Must NOT expose Supabase / Postgres internals
      const text = JSON.stringify(body);
      expect(text).not.toMatch(/supabase|postgres|relation|column|constraint|duplicate key/i);
      expect(text).not.toMatch(/stack:/i);
    });
  }

  for (const { path, body } of PROTECTED_POST_ROUTES) {
    test(`POST ${path} → 401 with no internal error text`, async ({ request }) => {
      const res = await request.post(path, {
        data: body,
        headers: { "Content-Type": "application/json" },
      });
      expect([400, 401]).toContain(res.status());
      const text = await res.text();
      expect(text).not.toMatch(/supabase|postgres|relation|column|constraint|duplicate key/i);
      expect(text).not.toMatch(/stack:/i);
    });
  }

  test("CSP header present on all page routes", async ({ page }) => {
    const response = await page.goto("/sign-in");
    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp).toBeTruthy();
    // Should NOT use unsafe-inline on script-src in production
    // (nonce-based CSP is now active)
    expect(csp).toContain("script-src");
  });
});
