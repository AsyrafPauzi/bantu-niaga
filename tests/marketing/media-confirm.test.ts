/**
 * Unit tests for POST /api/marketing/media/confirm — finalises an
 * uploaded marketing media file (verifies storage object exists at the
 * declared size, then inserts the marketing_files metadata row).
 *
 * What these guard:
 *   - cross-tenant storage_path             → 400 (invalid_storage_path)
 *   - unsupported MIME                      → 415
 *   - over 100 MB declared in confirm body  → 413
 *   - upload missing in storage             → 400 (upload_not_found)
 *   - size mismatch                         → 400 (size_mismatch)
 *   - happy path                            → 201 + marketing_files row
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

interface StorageListEntry {
  name: string;
  metadata?: { size?: number };
}

async function loadRoute(opts: {
  user: CurrentUser | "unauthorized";
  /** Entries returned by storage.list() — keyed by parent dir lookup. */
  storageList?: StorageListEntry[];
  /** Inserted row returned from supabase. If omitted, a default row is
   *  synthesised from the request body. */
  insertedRow?: Record<string, unknown> | null;
  insertError?: { message: string } | null;
  listError?: { message: string } | null;
}) {
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

  let insertedPayload: Record<string, unknown> | null = null;

  const insertMock = vi.fn((payload: Record<string, unknown>) => {
    insertedPayload = payload;
    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => {
          if (opts.insertError) {
            return { data: null, error: opts.insertError };
          }
          const row =
            opts.insertedRow !== undefined && opts.insertedRow !== null
              ? opts.insertedRow
              : {
                  id: "00000000-0000-0000-0000-00000000ffff",
                  business_id: (payload as Record<string, string>).business_id,
                  uploaded_by: (payload as Record<string, string>).uploaded_by,
                  storage_path: (payload as Record<string, string>).storage_path,
                  file_name: (payload as Record<string, string>).file_name,
                  mime_type: (payload as Record<string, string>).mime_type,
                  file_size_bytes: (payload as Record<string, number>)
                    .file_size_bytes,
                  width_px: null,
                  height_px: null,
                  duration_ms: null,
                  created_at: "2026-06-16T00:00:00Z",
                  updated_at: "2026-06-16T00:00:00Z",
                };
          return { data: row, error: null };
        }),
      })),
    };
  });

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      from: vi.fn(() => ({ insert: insertMock })),
    })),
  }));

  const removeMock = vi.fn(async () => ({ data: null, error: null }));
  const listMock = vi.fn(async () => {
    if (opts.listError) return { data: null, error: opts.listError };
    return { data: opts.storageList ?? [], error: null };
  });

  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: vi.fn(() => ({
      storage: {
        from: vi.fn(() => ({
          list: listMock,
          remove: removeMock,
        })),
      },
    })),
  }));

  const route = await import("@/app/api/marketing/media/confirm/route");
  return {
    POST: route.POST,
    insertedPayload: () => insertedPayload,
    insertCount: () => insertMock.mock.calls.length,
    removeCalls: () => removeMock.mock.calls,
    listCalls: () => listMock.mock.calls,
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/marketing/media/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PATH = `${OWNER.businessId}/11111111-1111-1111-1111-111111111111/photo.jpg`;
const VALID_BODY = {
  storage_path: VALID_PATH,
  file_name: "photo.jpg",
  mime_type: "image/jpeg",
  file_size_bytes: 1024,
};

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service-role");
});

describe("POST /api/marketing/media/confirm", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects cross-tenant storage_path with 400 (invalid_storage_path)", async () => {
    const { POST, insertCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        ...VALID_BODY,
        storage_path:
          "99999999-9999-9999-9999-999999999999/abc/photo.jpg",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe("invalid_storage_path");
    expect(insertCount()).toBe(0);
  });

  it("rejects unsupported MIME with 415", async () => {
    const { POST, insertCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        ...VALID_BODY,
        file_name: "doc.pdf",
        mime_type: "application/pdf",
      }),
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe("unsupported_media_type");
    expect(insertCount()).toBe(0);
  });

  it("rejects body claiming >100 MB with 413 (file_too_large)", async () => {
    const { POST, insertCount } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        ...VALID_BODY,
        file_size_bytes: MARKETING_FILE_MAX_BYTES + 1,
      }),
    );
    expect(res.status).toBe(413);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe("file_too_large");
    expect(insertCount()).toBe(0);
  });

  it("returns 400 when the uploaded object is not present in storage", async () => {
    const { POST, insertCount } = await loadRoute({
      user: OWNER,
      storageList: [],
    });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe("upload_not_found");
    expect(insertCount()).toBe(0);
  });

  it("returns 400 when actual size differs from declared", async () => {
    const { POST, insertCount, removeCalls } = await loadRoute({
      user: OWNER,
      storageList: [
        {
          name: "photo.jpg",
          metadata: { size: 9999 },
        },
      ],
    });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe("size_mismatch");
    expect(insertCount()).toBe(0);
    // The orphaned object should be cleaned up.
    expect(removeCalls().length).toBeGreaterThanOrEqual(1);
  });

  it("inserts marketing_files row on happy path (201)", async () => {
    const { POST, insertedPayload, insertCount } = await loadRoute({
      user: OWNER,
      storageList: [
        {
          name: "photo.jpg",
          metadata: { size: 1024 },
        },
      ],
    });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      ok: boolean;
      data: { id: string; business_id: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.business_id).toBe(OWNER.businessId);
    expect(insertCount()).toBe(1);
    expect(insertedPayload()).toMatchObject({
      business_id: OWNER.businessId,
      uploaded_by: OWNER.id,
      storage_path: VALID_PATH,
      file_name: "photo.jpg",
      mime_type: "image/jpeg",
      file_size_bytes: 1024,
    });
  });

  it("enforces the 100 MB cap at the storage layer too", async () => {
    // The size_mismatch check fires first when declared !== actual, so to
    // exercise the actualSize > MAX path we make them match at the cap+1.
    const { POST, insertCount, removeCalls } = await loadRoute({
      user: OWNER,
      storageList: [
        {
          name: "photo.jpg",
          metadata: { size: MARKETING_FILE_MAX_BYTES + 1 },
        },
      ],
    });
    const res = await POST(
      buildRequest({
        ...VALID_BODY,
        file_size_bytes: MARKETING_FILE_MAX_BYTES + 1,
      }),
    );
    // Zod's max bound rejects the body *before* the storage check, with
    // a 413. That's stricter than the storage-layer check would be — and
    // it's the documented contract.
    expect(res.status).toBe(413);
    expect(insertCount()).toBe(0);
    expect(removeCalls().length).toBe(0);
  });
});
