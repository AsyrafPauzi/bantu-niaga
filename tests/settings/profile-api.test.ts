/**
 * Unit tests for PATCH /api/settings/profile.
 *
 * The handler is imported dynamically per test so we can mock auth and the
 * Supabase query builder while still exercising the real route logic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

const CURRENT_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

const CURRENT_PROFILE = {
  id: CURRENT_USER.id,
  display_name: "Original Name",
  phone_e164: "+60123456789",
  email: "owner@example.test",
  role: "owner",
};

type FluentCall = {
  table: string;
  method: string;
  args: unknown[];
};

type LoadResult = {
  data: typeof CURRENT_PROFILE | null;
  error: { message: string } | null;
};

type UpdateResult = {
  data: typeof CURRENT_PROFILE | null;
  error: { message: string } | null;
};

type AuditResult = {
  data: unknown;
  error: { message: string } | null;
};

interface HarnessState {
  calls: FluentCall[];
  updatePayloads: unknown[];
  auditPayloads: unknown[];
  loadResult: LoadResult;
  updateResult: UpdateResult;
  auditResult: AuditResult;
}

interface Harness {
  PATCH: (request: Request) => Promise<Response>;
  state: HarnessState;
}

function record(state: HarnessState, table: string, method: string, args: unknown[]) {
  state.calls.push({ table, method, args });
}

function makeUsersSelectChain(state: HarnessState) {
  const chain = {
    eq: (...args: unknown[]) => {
      record(state, "users", "eq", args);
      return chain;
    },
    maybeSingle: async () => state.loadResult,
  };
  return chain;
}

function makeUsersUpdateChain(state: HarnessState, payload: unknown) {
  state.updatePayloads.push(payload);
  const chain = {
    eq: (...args: unknown[]) => {
      record(state, "users", "eq", args);
      return chain;
    },
    select: (...args: unknown[]) => {
      record(state, "users", "select", args);
      return {
        single: async () => state.updateResult,
      };
    },
  };
  return chain;
}

function makeUsersTable(state: HarnessState) {
  return {
    select: (...args: unknown[]) => {
      record(state, "users", "select", args);
      return makeUsersSelectChain(state);
    },
    update: (payload: unknown) => makeUsersUpdateChain(state, payload),
  };
}

function makeAuditTable(state: HarnessState) {
  return {
    insert: async (payload: unknown) => {
      state.auditPayloads.push(payload);
      return state.auditResult;
    },
  };
}

async function loadRoute(opts: {
  user?: CurrentUser | "unauthorized";
  loadResult?: LoadResult;
  updateResult?: UpdateResult;
  auditResult?: AuditResult;
} = {}): Promise<Harness> {
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
        return opts.user ?? CURRENT_USER;
      }),
    };
  });

  const state: HarnessState = {
    calls: [],
    updatePayloads: [],
    auditPayloads: [],
    loadResult: opts.loadResult ?? { data: CURRENT_PROFILE, error: null },
    updateResult:
      opts.updateResult ??
      {
        data: {
          ...CURRENT_PROFILE,
          display_name: "Updated Name",
          phone_e164: "+60199887766",
        },
        error: null,
      },
    auditResult: opts.auditResult ?? { data: null, error: null },
  };

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      from: (table: string) => {
        if (table === "users") return makeUsersTable(state);
        if (table === "audit_log") return makeAuditTable(state);
        throw new Error(`unexpected table: ${table}`);
      },
    })),
  }));

  const route = await import("@/app/api/settings/profile/route");
  return { PATCH: route.PATCH, state };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/settings/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/auth/current-user");
  vi.doUnmock("@/lib/supabase/server");
});

describe("PATCH /api/settings/profile", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when getCurrentUser throws UnauthorizedError", async () => {
    const { PATCH, state } = await loadRoute({ user: "unauthorized" });

    const res = await PATCH(buildRequest({ display_name: "No Session" }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(state.updatePayloads).toHaveLength(0);
  });

  it("rejects unknown fields instead of silently ignoring mass-assignment input", async () => {
    const { PATCH, state } = await loadRoute();

    const res = await PATCH(
      buildRequest({
        display_name: "Mallory",
        role: "owner",
        business_id: "00000000-0000-0000-0000-000000000ccc",
        id: "00000000-0000-0000-0000-000000000ddd",
        email: "mallory@example.test",
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
    expect(state.updatePayloads).toHaveLength(0);
    expect(state.auditPayloads).toHaveLength(0);
  });

  it("updates only allowlisted profile fields for the current user", async () => {
    const { PATCH, state } = await loadRoute();

    const res = await PATCH(
      buildRequest({
        display_name: "  Updated Name  ",
        phone_e164: "+60199887766",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      profile: {
        id: CURRENT_USER.id,
        display_name: "Updated Name",
        phone_e164: "+60199887766",
        email: "owner@example.test",
        role: "owner",
      },
    });
    expect(state.updatePayloads).toEqual([
      {
        display_name: "Updated Name",
        phone_e164: "+60199887766",
      },
    ]);
  });

  it("scopes the load and update queries by both current user id and business id", async () => {
    const { PATCH, state } = await loadRoute();

    await PATCH(
      buildRequest({
        display_name: "Updated Name",
      }),
    );

    const userEqCalls = state.calls.filter(
      (call) => call.table === "users" && call.method === "eq",
    );
    expect(
      userEqCalls.filter(
        (call) => call.args[0] === "id" && call.args[1] === CURRENT_USER.id,
      ),
    ).toHaveLength(2);
    expect(
      userEqCalls.filter(
        (call) =>
          call.args[0] === "business_id" &&
          call.args[1] === CURRENT_USER.businessId,
      ),
    ).toHaveLength(2);
  });

  it("inserts an audit log with only allowlisted changed-field diff entries", async () => {
    const { PATCH, state } = await loadRoute();

    const res = await PATCH(
      buildRequest({
        display_name: "Updated Name",
        phone_e164: "+60199887766",
      }),
    );

    expect(res.status).toBe(200);
    expect(state.auditPayloads).toEqual([
      {
        business_id: CURRENT_USER.businessId,
        actor_user_id: CURRENT_USER.id,
        action: "settings.profile.update",
        entity_type: "user",
        entity_id: CURRENT_USER.id,
        diff: {
          display_name: {
            before: "Original Name",
            after: "Updated Name",
          },
          phone_e164: {
            before: "+60123456789",
            after: "+60199887766",
          },
        },
      },
    ]);
  });

  it("returns a generic update_failed error without leaking raw DB messages", async () => {
    const { PATCH } = await loadRoute({
      updateResult: { data: null, error: { message: "permission denied for table users" } },
    });

    const res = await PATCH(buildRequest({ display_name: "Updated Name" }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "update_failed" });
  });
});
