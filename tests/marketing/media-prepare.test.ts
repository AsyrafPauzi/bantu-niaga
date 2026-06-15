/**
 * Unit tests for POST /api/marketing/media/prepare-upload — signed
 * upload URL issuer for the Content > New Post media picker.
 *
 * Mirrors `tests/admin/api-upload.test.ts`. The handler is imported
 * dynamically per test so each test can install its own mocks.
 *
 * What these guard:
 *   - unauthenticated request          → 401
 *   - non-marketing role (accountant)  → 403
 *   - 0 bytes                          → 400 (file_too_small / validation)
 *   - exactly 100 MB                   → 200 (boundary is inclusive)
 *   - 100 MB + 1 byte                  → 413 (file_too_large)
 *   - non-image/non-video MIME         → 415 (unsupported_media_type)
 *   - happy path                       → 200 + signed URL +
 *                                        storage_path layout pinned to
 *                                        <business_id>/<uuid>/<file_name>
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";
import { MARKETING_FILE_MAX_BYTES } from "@/lib/marketing/media-schemas";

const OWNER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const ACCOUNTANT: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "accountant",
  businessId: OWNER.businessId,
  isStub: false,
};

interface Harness {
  POST: (request: Request) => Promise<Response>;
  capturedPath: () => string | null;
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

  const route = await import("@/app/api/marketing/media/prepare-upload/route");
  return {
    POST: route.POST,
    capturedPath: () => capturedPath,
    signCallCount: () => signCallCount,
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/marketing/media/prepare-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/service-role");
});

describe("POST /api/marketing/media/prepare-upload — auth + size + MIME gating", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects unauthenticated request with 401", async () => {
    const { POST, signCallCount } = await loadRoute({ user: "unauthorized" });
    const res = await POST(
      buildRequest({
        file_name: "ok.jpg",
        mime_type: "image/jpeg",
        file_size_bytes: 1024,
      }),
    );
    expect(res.status).toBe(401);
    expect(signCallCount()).toBe(0);
  });

  it("rejects accountant with 403 (no marketing.content access)", async () => {
    const { POST, signCallCount } = await loadRoute({ user: ACCOUNTANT });
    const res = await POST(
      buildRequest({
        file_name: "ok.jpg",
        mime_type: "image/jpeg",
        file_size_bytes: 1024,
      }),
    );
    expect(res.status).toBe(403);
    expect(signCallCount()).toBe(0);
  });

  it("rejects 0 bytes (file_too_small)", async () => {
    const { POST, signCallCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "empty.jpg",
        mime_type: "image/jpeg",
        file_size_bytes: 0,
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(["file_too_small", "validation_failed"]).toContain(body.error.code);
    expect(signCallCount()).toBe(0);
  });

  it("rejects 100 MB + 1 byte with 413 (file_too_large)", async () => {
    const { POST, signCallCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "huge.mp4",
        mime_type: "video/mp4",
        file_size_bytes: MARKETING_FILE_MAX_BYTES + 1,
      }),
    );
    expect(res.status).toBe(413);
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("file_too_large");
    expect(body.error.message).toMatch(/100 MB/);
    expect(signCallCount()).toBe(0);
  });

  it("accepts exactly 100 MB (200 OK)", async () => {
    const { POST, capturedPath, signCallCount } = await loadRoute({
      user: OWNER,
    });
    const res = await POST(
      buildRequest({
        file_name: "max.mp4",
        mime_type: "video/mp4",
        file_size_bytes: MARKETING_FILE_MAX_BYTES,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        upload_url: string;
        storage_path: string;
        expires_at: string;
        temp_id: string;
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.upload_url).toContain("supabase.test/upload");
    expect(body.data.storage_path).toMatch(
      new RegExp(`^${OWNER.businessId}/[0-9a-f-]{36}/max\\.mp4$`),
    );
    expect(typeof body.data.temp_id).toBe("string");
    expect(body.data.temp_id.length).toBeGreaterThan(0);
    expect(capturedPath()).toBe(body.data.storage_path);
    expect(signCallCount()).toBe(1);
  });

  it("rejects unsupported MIME type with 415", async () => {
    const { POST, signCallCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "doc.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 1024,
      }),
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe("unsupported_media_type");
    expect(signCallCount()).toBe(0);
  });

  it("sanitises path separators in file_name", async () => {
    const { POST, capturedPath } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        file_name: "../../etc/passwd.jpg",
        mime_type: "image/jpeg",
        file_size_bytes: 1024,
      }),
    );
    expect(res.status).toBe(200);
    const captured = capturedPath() ?? "";
    const segments = captured.split("/");
    expect(segments[0]).toBe(OWNER.businessId);
    expect(segments.length).toBe(3);
    expect(segments[2]).not.toMatch(/[\\/]/);
    expect(segments[1]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
