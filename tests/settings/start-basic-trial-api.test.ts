import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/current-user";

const OWNER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

async function loadRoute(opts: {
  user?: CurrentUser | "unauthorized";
  standalone?: boolean;
  rpcError?: { message: string } | null;
}) {
  vi.resetModules();
  vi.doMock("@/lib/platform/deployment", () => ({
    isStandaloneDeployment: () => opts.standalone === true,
  }));
  vi.doMock("@/lib/api/auth-rate-limit", () => ({
    enforceAuthRateLimit: () => ({ ok: true, headers: {} }),
  }));
  vi.doMock("@/lib/logger", () => ({
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      child: () => ({ error: vi.fn() }),
    },
  }));
  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth/current-user")>(
      "@/lib/auth/current-user",
    );
    return {
      ...actual,
      getCurrentUser: async () => {
        if (opts.user === "unauthorized") {
          throw new actual.UnauthorizedError("no_session");
        }
        return opts.user ?? OWNER;
      },
    };
  });
  const rpc = vi.fn(async () => ({
    data: null,
    error: opts.rpcError ?? null,
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => ({ rpc }),
  }));
  const route = await import(
    "@/app/api/settings/subscription/start-basic-trial/route"
  );
  return { POST: route.POST, rpc };
}

function post() {
  return new Request(
    "http://localhost/api/settings/subscription/start-basic-trial",
    { method: "POST" },
  );
}

describe("POST /api/settings/subscription/start-basic-trial", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await loadRoute({ user: "unauthorized" });
    const res = await POST(post());
    expect(res.status).toBe(401);
  });

  it("returns 403 for standalone", async () => {
    const { POST } = await loadRoute({ standalone: true });
    const res = await POST(post());
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-owner", async () => {
    const { POST } = await loadRoute({
      user: { ...OWNER, role: "manager" },
    });
    const res = await POST(post());
    expect(res.status).toBe(403);
  });

  it("returns 409 when RPC says trial_already_used", async () => {
    const { POST } = await loadRoute({
      rpcError: { message: "trial_already_used" },
    });
    const res = await POST(post());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: "trial_already_used" });
  });

  it("returns 200 and calls RPC with session business id", async () => {
    const { POST, rpc } = await loadRoute({});
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("settings_start_basic_trial", {
      p_business_id: OWNER.businessId,
      p_user_id: OWNER.id,
    });
  });
});
