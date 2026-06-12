/**
 * Integration tests for POST /api/marketing/customers.
 *
 * Strategy: mock `getCurrentUser` and `createSupabaseServerClient` at the
 * module boundary so we exercise the actual route handler logic without a
 * live HTTP server. The handler is imported dynamically per test so each
 * test can install its own mocks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

const OWNER_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const ACCOUNTANT_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000cc",
  role: "accountant",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

type DedupResult = {
  action: "new" | "merge" | "prompt";
  existingCustomerId?: string;
  existingName?: string;
};

interface RouteHarness {
  POST: (request: Request) => Promise<Response>;
  rpcMock: ReturnType<typeof vi.fn>;
}

async function loadRoute(opts: {
  user?: CurrentUser | "unauthorized";
  dedup: DedupResult;
  rpc?: { data: unknown; error: { message: string } | null };
}): Promise<RouteHarness> {
  vi.resetModules();

  const { UnauthorizedError } = await import("@/lib/auth/current-user");

  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth/current-user")>(
      "@/lib/auth/current-user",
    );
    return {
      ...actual,
      getCurrentUser: vi.fn(async () => {
        if (opts.user === "unauthorized") {
          throw new UnauthorizedError("no_session", "test: no session");
        }
        return opts.user ?? OWNER_USER;
      }),
    };
  });

  const rpcMock = vi.fn(async () =>
    opts.rpc ?? {
      data: [
        {
          customer_id: "00000000-0000-0000-0000-00000000cust",
          event_id: "00000000-0000-0000-0000-000000000evt",
        },
      ],
      error: null,
    },
  );

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({ rpc: rpcMock })),
  }));

  vi.doMock("@/lib/marketing/dedup", () => ({
    dedupCustomer: vi.fn(async () => opts.dedup),
  }));

  const route = await import("@/app/api/marketing/customers/route");
  return { POST: route.POST, rpcMock };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/marketing/customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/marketing/dedup");
});

describe("POST /api/marketing/customers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when getCurrentUser throws UnauthorizedError", async () => {
    const { POST } = await loadRoute({
      user: "unauthorized",
      dedup: { action: "new" },
    });
    const res = await POST(buildRequest({ name: "Test", source: "manual" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 403 when the caller lacks marketing.customers access (accountant)", async () => {
    const { POST, rpcMock } = await loadRoute({
      user: ACCOUNTANT_USER,
      dedup: { action: "new" },
    });
    const res = await POST(buildRequest({ name: "Test", source: "manual" }));
    expect(res.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 400 when Zod validation fails (missing name)", async () => {
    const { POST } = await loadRoute({ dedup: { action: "new" } });
    const res = await POST(buildRequest({ source: "manual" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
  });

  it("returns 400 when phone is provided but unparseable", async () => {
    const { POST, rpcMock } = await loadRoute({ dedup: { action: "new" } });
    const res = await POST(
      buildRequest({
        name: "Test",
        phone: "not-a-phone",
        source: "manual",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_phone");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("happy path `new` — returns 201 with action='created'", async () => {
    const { POST, rpcMock } = await loadRoute({ dedup: { action: "new" } });
    const res = await POST(
      buildRequest({
        name: "Ali bin Abu",
        phone: "+60123456789",
        source: "manual",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.action).toBe("created");
    expect(body.customer_id).toBe("00000000-0000-0000-0000-00000000cust");
    expect(body.event_id).toBe("00000000-0000-0000-0000-000000000evt");
    expect(rpcMock).toHaveBeenCalledWith(
      "marketing_create_customer",
      expect.objectContaining({
        p_business_id: OWNER_USER.businessId,
        p_name: "Ali bin Abu",
        p_phone_e164: "+60123456789",
        p_source: "manual",
        p_created_by_user_id: OWNER_USER.id,
      }),
    );
  });

  it("`merge` outcome — returns 200 without inserting", async () => {
    const { POST, rpcMock } = await loadRoute({
      dedup: {
        action: "merge",
        existingCustomerId: "cust_existing",
        existingName: "Ali bin Abu",
      },
    });
    const res = await POST(
      buildRequest({
        name: "ali bin abu",
        phone: "+60123456789",
        source: "manual",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("merged");
    expect(body.customer_id).toBe("cust_existing");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("`prompt` outcome — returns 200 with potential match, no insert", async () => {
    const { POST, rpcMock } = await loadRoute({
      dedup: {
        action: "prompt",
        existingCustomerId: "cust_existing",
        existingName: "Siti Sara",
      },
    });
    const res = await POST(
      buildRequest({
        name: "Ali bin Abu",
        phone: "+60123456789",
        source: "manual",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("prompt");
    expect(body.existing_customer_id).toBe("cust_existing");
    expect(body.existing_name).toBe("Siti Sara");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("force_create=true on a `prompt` hit drops the colliding phone so the unique-phone partial index doesn't 23505", async () => {
    const { POST, rpcMock } = await loadRoute({
      dedup: {
        action: "prompt",
        existingCustomerId: "cust_existing",
        existingName: "Siti Sara",
      },
    });
    const res = await POST(
      buildRequest({
        name: "Ali bin Abu",
        phone: "+60123456789",
        source: "manual",
        force_create: true,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.action).toBe("created");
    expect(rpcMock).toHaveBeenCalledWith(
      "marketing_create_customer",
      expect.objectContaining({
        p_business_id: OWNER_USER.businessId,
        p_name: "Ali bin Abu",
        p_phone_e164: null,
        p_source: "manual",
      }),
    );
  });

  it("returns 500 when the RPC reports an error", async () => {
    const { POST } = await loadRoute({
      dedup: { action: "new" },
      rpc: { data: null, error: { message: "rpc exploded" } },
    });
    const res = await POST(
      buildRequest({
        name: "Test",
        phone: "+60123456789",
        source: "manual",
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("insert_failed");
  });
});
