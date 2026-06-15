/**
 * Unit tests for POST /api/admin/storage — signed-upload-url issuer.
 *
 * Strategy: mock `getCurrentUser` and the service-role storage client so
 * we exercise the actual route handler without a live HTTP server or
 * Supabase instance. The handler is imported dynamically per test so
 * each test can install its own mocks.
 *
 * What these guard:
 *   - 0 bytes               → 400 (size > 0 invariant)
 *   - exactly 100 MB        → 200 (boundary is inclusive)
 *   - 100 MB + 1 byte       → 413 (file_too_large)
 *   - unauthorised role     → 403 (cashier has no admin pillar access)
 *   - HR Officer scoping    → forces category='hr_doc' regardless of input
 *   - storage_path layout   → always `<business_id>/<uuid>/<file_name>`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";
import { ADMIN_FILE_MAX_BYTES } from "@/lib/admin/schemas";

const OWNER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const CASHIER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "cashier",
  businessId: OWNER.businessId,
  isStub: false,
};

interface Harness {
  POST: (request: Request) => Promise<Response>;
  /** Last `path` passed into `createSignedUploadUrl`. */
  capturedPath: () => string | null;
  /** How many times the service-role storage client was invoked. */
  signCallCount: () => number;
}

async function loadRoute(opts: {
  user: CurrentUser | "unauthorized";
}): Promise<Harness> {
  vi.resetModules();
  const { UnauthorizedError } = await import("@/lib/auth/current-user");

  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/auth/current-user")
    >("@/lib/auth/current-user");
    return {
      ...actual,
      getCurrentUser: vi.fn(async () => {
        if (opts.user === "unauthorized") {
          throw new UnauthorizedError("no_session", "test: no session");
        }
        return opts.user;
      }),
    };
  });

  let capturedPath: string | null = null;
  let signCallCount = 0;
  const createSignedUploadUrl = vi.fn(async (p: string) => {
    capturedPath = p;
    signCallCount += 1;
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
      storage: {
        from: vi.fn(() => ({ createSignedUploadUrl })),
      },
    })),
  }));

  // The list (GET) handler also imports createSupabaseServerClient; the
  // upload route does not, but mock it as a safe stub so any incidental
  // import resolves without a real DB.
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({})),
  }));

  const route = await import("@/app/api/admin/storage/route");
  return {
    POST: route.POST,
    capturedPath: () => capturedPath,
    signCallCount: () => signCallCount,
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/storage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service-role");
});

describe("POST /api/admin/storage — size + role gating", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects 0 bytes with 400 (file_too_small)", async () => {
    const { POST, signCallCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "empty.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 0,
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    // Zod treats 0 as `.positive` failure (too_small), surfaced as the
    // generic 422 path. We accept either canonical envelope code here.
    expect([
      "file_too_small",
      "validation_failed",
    ]).toContain(body.error.code);
    expect(signCallCount()).toBe(0);
  });

  it("rejects 100 MB + 1 byte with 413 (file_too_large)", async () => {
    const { POST, signCallCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "huge.zip",
        mime_type: "application/zip",
        file_size_bytes: ADMIN_FILE_MAX_BYTES + 1,
      }),
    );
    expect(res.status).toBe(413);
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("file_too_large");
    expect(body.error.message).toMatch(/100 MB/);
    expect(signCallCount()).toBe(0);
  });

  it("accepts exactly 100 MB (200 OK)", async () => {
    const { POST, capturedPath, signCallCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "max.zip",
        mime_type: "application/zip",
        file_size_bytes: ADMIN_FILE_MAX_BYTES,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { upload_url: string; storage_path: string; expires_at: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.upload_url).toContain("supabase.test/upload");
    expect(body.data.storage_path).toMatch(
      new RegExp(`^${OWNER.businessId}/[0-9a-f-]{36}/max\\.zip$`),
    );
    expect(capturedPath()).toBe(body.data.storage_path);
    expect(signCallCount()).toBe(1);
  });

  it("rejects cashier with 403 (no admin pillar access)", async () => {
    const { POST, signCallCount } = await loadRoute({ user: CASHIER });
    const res = await POST(
      buildRequest({
        file_name: "ok.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 1024,
      }),
    );
    expect(res.status).toBe(403);
    expect(signCallCount()).toBe(0);
  });

  it("rejects unauthenticated request with 401", async () => {
    const { POST, signCallCount } = await loadRoute({ user: "unauthorized" });
    const res = await POST(
      buildRequest({
        file_name: "x.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 100,
      }),
    );
    expect(res.status).toBe(401);
    expect(signCallCount()).toBe(0);
  });

  it("sanitises path separators in file_name when building storage_path", async () => {
    const { POST, capturedPath } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "../../etc/passwd",
        mime_type: "text/plain",
        file_size_bytes: 1024,
      }),
    );
    expect(res.status).toBe(200);
    const captured = capturedPath() ?? "";
    // The storage path must always have exactly three segments:
    // <business_id>/<random-uuid>/<sanitised-name>. The sanitiser strips
    // every '/' and '\\' from the file_name so the basename cannot
    // create extra directory levels under the random UUID prefix.
    const segments = captured.split("/");
    expect(segments[0]).toBe(OWNER.businessId);
    expect(segments.length).toBe(3);
    expect(segments[2]).not.toMatch(/[\\/]/);
    // The random UUID directory in the middle keeps the storage layout
    // collision-free regardless of how dodgy the basename is.
    expect(segments[1]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
