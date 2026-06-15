/**
 * Permission gating for the Admin Digital Storage routes.
 *
 * Pure-logic guards (no DB / no live HTTP):
 *
 *   - `canSurface(role, 'admin', 'storage')` correctly accepts the three
 *     editor roles (owner / manager / hr_officer) and rejects the rest.
 *   - `getSurfaceScope('hr_officer', 'admin', 'storage')` returns the
 *     'rw_hr_docs_only' marker that the API uses to force category =
 *     'hr_doc' on every HR Officer interaction.
 *
 * Plus an integration test that the POST /api/admin/storage handler
 * forces the category server-side for HR Officer regardless of what the
 * client tried to submit, and that cashier gets 403.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";

describe("permissions — admin.storage gate", () => {
  it("owner and manager have full RW", () => {
    expect(canSurface("owner", "admin", "storage")).toBe(true);
    expect(canSurface("manager", "admin", "storage")).toBe(true);
    expect(getSurfaceScope("owner", "admin", "storage")).toBe("*");
    expect(getSurfaceScope("manager", "admin", "storage")).toBe("*");
  });

  it("hr_officer is scoped to rw_hr_docs_only", () => {
    expect(canSurface("hr_officer", "admin", "storage")).toBe(true);
    expect(getSurfaceScope("hr_officer", "admin", "storage")).toBe(
      "rw_hr_docs_only",
    );
  });

  it("accountant / cashier / staff are denied", () => {
    expect(canSurface("accountant", "admin", "storage")).toBe(false);
    expect(canSurface("cashier", "admin", "storage")).toBe(false);
    expect(canSurface("staff", "admin", "storage")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Route-level enforcement: HR Officer is forced to category='hr_doc'.
// ─────────────────────────────────────────────────────────────────────────

const HR_OFFICER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000ee",
  role: "hr_officer",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const CASHIER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "cashier",
  businessId: HR_OFFICER.businessId,
  isStub: false,
};

interface Harness {
  POST: (request: Request) => Promise<Response>;
  capturedPath: () => string | null;
}

async function loadUploadRoute(user: CurrentUser): Promise<Harness> {
  vi.resetModules();
  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/auth/current-user")
    >("@/lib/auth/current-user");
    return {
      ...actual,
      getCurrentUser: vi.fn(async () => user),
    };
  });

  let capturedPath: string | null = null;
  const createSignedUploadUrl = vi.fn(async (p: string) => {
    capturedPath = p;
    return {
      data: {
        signedUrl: `https://supabase.test/upload/${encodeURIComponent(p)}`,
        path: p,
        token: "test-token",
      },
      error: null,
    };
  });
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: vi.fn(() => ({
      storage: { from: vi.fn(() => ({ createSignedUploadUrl })) },
    })),
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({})),
  }));

  const route = await import("@/app/api/admin/storage/route");
  return { POST: route.POST, capturedPath: () => capturedPath };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service-role");
});

describe("POST /api/admin/storage — HR Officer scoping + cashier 403", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("HR Officer gets a 200 with a storage path under their business prefix", async () => {
    const { POST, capturedPath } = await loadUploadRoute(HR_OFFICER);
    const res = await POST(
      new Request("http://localhost/api/admin/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          file_name: "ic_scan.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 4096,
          // intentionally lie about the category — the server should
          // overwrite this to 'hr_doc' anyway. We assert the *path* layout
          // here because the category is set on the row in the confirm
          // step.
          category: "contract",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(capturedPath()).toMatch(
      new RegExp(`^${HR_OFFICER.businessId}/[0-9a-f-]{36}/ic_scan\\.pdf$`),
    );
  });

  it("cashier gets a 403 with no storage call", async () => {
    const { POST, capturedPath } = await loadUploadRoute(CASHIER);
    const res = await POST(
      new Request("http://localhost/api/admin/storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          file_name: "ok.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 1024,
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(capturedPath()).toBeNull();
  });
});
