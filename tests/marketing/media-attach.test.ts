/**
 * Unit tests for POST /api/marketing/media/attach-to-content — links
 * one or more uploaded marketing_files rows to a content_plan row via
 * the content_plan_media join table.
 *
 * What these guard:
 *   - unauthenticated request                  → 401
 *   - accountant role                          → 403
 *   - missing content_plan row                 → 404
 *   - any file_id not in caller's business     → 422 + missing list
 *   - happy path                               → 200, upsert called with
 *                                                 (content_plan_id, file_id,
 *                                                  business_id, position)
 *                                                 and position_start applied.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

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

const CONTENT_PLAN_ID = "00000000-0000-0000-0000-00000000aaaa";
const FILE_A = "00000000-0000-0000-0000-00000000aaab";
const FILE_B = "00000000-0000-0000-0000-00000000aaac";

interface LoadOpts {
  user: CurrentUser | "unauthorized";
  planExists?: boolean;
  filesFound?: string[];
  upsertError?: { message: string } | null;
}

async function loadRoute(opts: LoadOpts) {
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

  const planLookup = vi.fn(async () => ({
    data: opts.planExists === false ? null : {
      id: CONTENT_PLAN_ID,
      business_id: OWNER.businessId,
    },
    error: null,
  }));

  const filesLookup = vi.fn(async () => ({
    data: (opts.filesFound ?? [FILE_A, FILE_B]).map((id) => ({ id })),
    error: null,
  }));

  const upsertMock = vi.fn(async () => ({
    error: opts.upsertError ?? null,
  }));

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      from: vi.fn((table: string) => {
        if (table === "content_plan") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({ maybeSingle: planLookup })),
              })),
            })),
          };
        }
        if (table === "marketing_files") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(() => ({ is: filesLookup })),
              })),
            })),
          };
        }
        if (table === "content_plan_media") {
          return {
            upsert: upsertMock,
          };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    })),
  }));

  const route = await import(
    "@/app/api/marketing/media/attach-to-content/route"
  );
  return {
    POST: route.POST,
    upsertMock,
    planLookup,
    filesLookup,
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/marketing/media/attach-to-content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
});

describe("POST /api/marketing/media/attach-to-content", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects unauthenticated request with 401", async () => {
    const { POST, upsertMock } = await loadRoute({ user: "unauthorized" });
    const res = await POST(
      buildRequest({
        content_plan_id: CONTENT_PLAN_ID,
        file_ids: [FILE_A],
      }),
    );
    expect(res.status).toBe(401);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects accountant with 403", async () => {
    const { POST, upsertMock } = await loadRoute({ user: ACCOUNTANT });
    const res = await POST(
      buildRequest({
        content_plan_id: CONTENT_PLAN_ID,
        file_ids: [FILE_A],
      }),
    );
    expect(res.status).toBe(403);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the content_plan row is in another business", async () => {
    const { POST, upsertMock } = await loadRoute({
      user: OWNER,
      planExists: false,
    });
    const res = await POST(
      buildRequest({
        content_plan_id: CONTENT_PLAN_ID,
        file_ids: [FILE_A],
      }),
    );
    expect(res.status).toBe(404);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns 422 with a missing list when a file_id is unknown", async () => {
    const { POST, upsertMock } = await loadRoute({
      user: OWNER,
      filesFound: [FILE_A],
    });
    const res = await POST(
      buildRequest({
        content_plan_id: CONTENT_PLAN_ID,
        file_ids: [FILE_A, FILE_B],
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string; details?: { missing?: string[] } };
    };
    expect(body.error.code).toBe("invalid_file_ids");
    expect(body.error.details?.missing).toEqual([FILE_B]);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("happy path — upserts (content_plan_id, file_id, business_id, position)", async () => {
    const { POST, upsertMock } = await loadRoute({
      user: OWNER,
      filesFound: [FILE_A, FILE_B],
    });
    const res = await POST(
      buildRequest({
        content_plan_id: CONTENT_PLAN_ID,
        file_ids: [FILE_A, FILE_B],
        position_start: 3,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { content_plan_id: string; attached: number };
    };
    expect(body.ok).toBe(true);
    expect(body.data.content_plan_id).toBe(CONTENT_PLAN_ID);
    expect(body.data.attached).toBe(2);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const firstCall = upsertMock.mock.calls[0] as unknown as [
      unknown[],
      { onConflict?: string },
    ];
    const [rows, opts] = firstCall;
    expect(rows).toEqual([
      {
        content_plan_id: CONTENT_PLAN_ID,
        file_id: FILE_A,
        business_id: OWNER.businessId,
        position: 3,
      },
      {
        content_plan_id: CONTENT_PLAN_ID,
        file_id: FILE_B,
        business_id: OWNER.businessId,
        position: 4,
      },
    ]);
    expect(opts?.onConflict).toBe("content_plan_id,file_id");
  });

  it("validates file_ids array is non-empty (422)", async () => {
    const { POST, upsertMock } = await loadRoute({ user: OWNER });
    const res = await POST(
      buildRequest({
        content_plan_id: CONTENT_PLAN_ID,
        file_ids: [],
      }),
    );
    expect(res.status).toBe(422);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
