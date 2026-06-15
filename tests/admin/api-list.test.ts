/**
 * Unit tests for GET /api/admin/storage — list endpoint.
 *
 * Mocks the server Supabase client so we can verify, without a DB:
 *
 *   1. The query is always scoped to the caller's business_id via
 *      `.eq("business_id", …)` and excludes soft-deleted rows via
 *      `.is("deleted_at", null)`.
 *   2. HR Officer is server-side pinned to `category = 'hr_doc'`,
 *      regardless of any `?category=` query param.
 *   3. The handler returns 403 for cashier without ever touching the DB.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

const OWNER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const HR_OFFICER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000ee",
  role: "hr_officer",
  businessId: OWNER.businessId,
  isStub: false,
};

const CASHIER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "cashier",
  businessId: OWNER.businessId,
  isStub: false,
};

interface FluentCall {
  method: string;
  args: unknown[];
}

interface MockBuilder {
  fluentCalls: FluentCall[];
  rows: Array<{
    id: string;
    business_id: string;
    uploaded_by: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
    category: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

function makeQueryChain(state: MockBuilder) {
  const record = (method: string) => (...args: unknown[]) => {
    state.fluentCalls.push({ method, args });
    return chain;
  };
  const chain: Record<string, unknown> = {
    select: record("select"),
    eq: record("eq"),
    is: record("is"),
    order: record("order"),
    or: record("or"),
    ilike: record("ilike"),
    in: record("in"),
    limit: record("limit"),
    then: (resolve: (v: { data: unknown; error: null }) => void) =>
      resolve({ data: state.rows, error: null }),
  };
  return chain;
}

interface Harness {
  GET: (request: Request) => Promise<Response>;
  state: MockBuilder;
}

async function loadListRoute(user: CurrentUser): Promise<Harness> {
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

  const state: MockBuilder = {
    fluentCalls: [],
    rows: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        business_id: user.businessId,
        uploaded_by: user.id,
        storage_path: `${user.businessId}/abc/test.pdf`,
        file_name: "test.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 1024,
        category: "hr_doc",
        description: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      from: (table: string) => {
        if (table === "users") {
          // The handler hydrates uploader names with a separate `.in()`
          // round-trip; resolve to an empty list since we don't assert
          // on it.
          return {
            select: () => ({
              in: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        return makeQueryChain(state);
      },
    })),
  }));

  // The list handler does not call the service-role client, but stub it
  // so any incidental import resolves cleanly.
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: vi.fn(() => ({})),
  }));

  const route = await import("@/app/api/admin/storage/route");
  return { GET: route.GET, state };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service-role");
});

describe("GET /api/admin/storage — list", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("scopes by business_id and excludes soft-deleted (owner)", async () => {
    const { GET, state } = await loadListRoute(OWNER);
    const res = await GET(
      new Request("http://localhost/api/admin/storage", { method: "GET" }),
    );
    expect(res.status).toBe(200);
    const eqCalls = state.fluentCalls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some(
        (c) => c.args[0] === "business_id" && c.args[1] === OWNER.businessId,
      ),
    ).toBe(true);
    const isCalls = state.fluentCalls.filter((c) => c.method === "is");
    expect(
      isCalls.some((c) => c.args[0] === "deleted_at" && c.args[1] === null),
    ).toBe(true);
  });

  it("HR Officer is pinned to category='hr_doc' even when the URL says otherwise", async () => {
    const { GET, state } = await loadListRoute(HR_OFFICER);
    const res = await GET(
      new Request(
        "http://localhost/api/admin/storage?category=contract",
        { method: "GET" },
      ),
    );
    expect(res.status).toBe(200);
    const eqCalls = state.fluentCalls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some(
        (c) => c.args[0] === "category" && c.args[1] === "hr_doc",
      ),
    ).toBe(true);
    // Crucially: no `.eq('category', 'contract')` was applied.
    expect(
      eqCalls.some(
        (c) => c.args[0] === "category" && c.args[1] === "contract",
      ),
    ).toBe(false);
  });

  it("returns 403 for cashier and does not touch the DB", async () => {
    const { GET, state } = await loadListRoute(CASHIER);
    const res = await GET(
      new Request("http://localhost/api/admin/storage", { method: "GET" }),
    );
    expect(res.status).toBe(403);
    expect(state.fluentCalls.length).toBe(0);
  });
});
