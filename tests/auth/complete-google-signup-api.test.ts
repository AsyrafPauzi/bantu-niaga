import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const AUTH_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "owner@example.test",
};

const OTHER_ID = "22222222-2222-2222-2222-222222222222";

const VALID_BODY = {
  business_name: "Kedai Contoh",
  state_code: "KUL",
  accept_terms: true,
  signup_path: "free",
};

interface HarnessOpts {
  standalone?: boolean;
  user?: { id: string; email: string } | null;
  profileById?: { id: string } | null;
  profileByEmail?: { id: string } | null;
  provisionOk?: boolean;
}

interface Harness {
  POST: (request: Request) => Promise<Response>;
  provisionOwnerBusiness: ReturnType<typeof vi.fn>;
}

async function loadRoute(opts: HarnessOpts = {}): Promise<Harness> {
  vi.resetModules();

  vi.doMock("@/lib/platform/deployment", () => ({
    isStandaloneDeployment: () => opts.standalone === true,
  }));

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn(async () => ({
      auth: {
        getUser: async () => ({
          data: { user: opts.user === undefined ? AUTH_USER : opts.user },
        }),
      },
    })),
  }));

  const provisionOwnerBusiness = vi.fn(
    async (
      _admin: unknown,
      _input: unknown,
    ): Promise<
      | { ok: true; businessId: string; idcompany: string }
      | { ok: false; error: string; message: string; status: number }
    > => {
      if (opts.provisionOk === false) {
        return {
          ok: false,
          error: "business_create_failed",
          message: "Could not create business",
          status: 500,
        };
      }
      return {
        ok: true,
        businessId: "biz-1",
        idcompany: "kedai-contoh-abc123",
      };
    },
  );

  vi.doMock("@/lib/auth/provision-owner-business", () => ({
    provisionOwnerBusiness,
  }));

  let idLookup = true;
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: () => ({
      from: (table: string) => {
        if (table !== "users") {
          throw new Error(`unexpected table: ${table}`);
        }
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: async () => {
                if (idLookup) {
                  idLookup = false;
                  return { data: opts.profileById ?? null, error: null };
                }
                return { data: opts.profileByEmail ?? null, error: null };
              },
            }),
          }),
        };
      },
    }),
  }));

  const route = await import("@/app/api/auth/complete-google-signup/route");
  return { POST: route.POST, provisionOwnerBusiness };
}

let requestSeq = 0;

function buildRequest(body: unknown): Request {
  requestSeq += 1;
  return new Request("http://localhost/api/auth/complete-google-signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `203.0.113.${requestSeq}`,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/platform/deployment");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service-role");
  vi.doUnmock("@/lib/auth/provision-owner-business");
});

describe("POST /api/auth/complete-google-signup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when there is no session", async () => {
    const { POST } = await loadRoute({ user: null });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 in standalone", async () => {
    const { POST } = await loadRoute({ standalone: true });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("signup_disabled");
  });

  it("rejects extra email in the body", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      buildRequest({ ...VALID_BODY, email: "attacker@example.test" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_failed");
  });

  it("returns 409 when the email belongs to another profile", async () => {
    const { POST, provisionOwnerBusiness } = await loadRoute({
      profileById: null,
      profileByEmail: { id: OTHER_ID },
    });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("email_taken");
    expect(provisionOwnerBusiness).not.toHaveBeenCalled();
  });

  it("is idempotent when the profile already exists", async () => {
    const { POST, provisionOwnerBusiness } = await loadRoute({
      profileById: { id: AUTH_USER.id },
    });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, already_complete: true });
    expect(provisionOwnerBusiness).not.toHaveBeenCalled();
  });

  it("provisions from the session email, not the body", async () => {
    const { POST, provisionOwnerBusiness } = await loadRoute({
      profileById: null,
      profileByEmail: null,
    });
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(provisionOwnerBusiness).toHaveBeenCalledTimes(1);
    const input = provisionOwnerBusiness.mock.calls[0][1] as {
      authUserId: string;
      email: string;
      signupSource: string;
      businessName: string;
    };
    expect(input.authUserId).toBe(AUTH_USER.id);
    expect(input.email).toBe(AUTH_USER.email);
    expect(input.signupSource).toBe("google");
    expect(input.businessName).toBe("Kedai Contoh");
  });
});
