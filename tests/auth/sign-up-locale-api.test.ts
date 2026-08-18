import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_BODY = {
  email: "owner@example.test",
  password: "CorrectHorse1x",
  business_name: "Kedai Contoh",
  state_code: "KUL",
  accept_terms: true,
  signup_path: "free",
  preferred_locale: "ms",
};

async function loadRoute() {
  vi.resetModules();
  vi.doMock("@/lib/platform/deployment", () => ({
    isStandaloneDeployment: () => false,
  }));
  vi.doMock("@/lib/auth/email-verification-policy", () => ({
    isEmailVerificationRequired: () => false,
  }));
  const createUser = vi.fn(async () => ({
    data: { user: { id: "user-1", email: VALID_BODY.email } },
    error: null,
  }));
  const provisionOwnerBusiness = vi.fn(async () => ({
    ok: true as const,
    businessId: "biz-1",
    idcompany: "kedai-contoh-abc123",
  }));
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: () => ({
      auth: { admin: { createUser, deleteUser: vi.fn() } },
    }),
  }));
  vi.doMock("@/lib/auth/provision-owner-business", () => ({
    provisionOwnerBusiness,
  }));
  const route = await import("@/app/api/auth/sign-up/route");
  return { POST: route.POST, createUser, provisionOwnerBusiness };
}

function buildRequest(body: unknown, ip = "203.0.113.40"): Request {
  return new Request("http://localhost/api/auth/sign-up", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/platform/deployment");
  vi.doUnmock("@/lib/auth/email-verification-policy");
  vi.doUnmock("@/lib/supabase/service-role");
  vi.doUnmock("@/lib/auth/provision-owner-business");
});

describe("POST /api/auth/sign-up locale", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("writes preferred_locale to Auth metadata and provision", async () => {
    const { POST, createUser, provisionOwnerBusiness } = await loadRoute();
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          preferred_locale: "ms",
          signup_source: "self_serve",
        }),
      }),
    );
    expect(provisionOwnerBusiness).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preferredLocale: "ms" }),
    );
  });

  it("returns 400 when preferred_locale is missing", async () => {
    const { POST, provisionOwnerBusiness } = await loadRoute();
    const { preferred_locale: _locale, ...rest } = VALID_BODY;
    const res = await POST(buildRequest(rest, "203.0.113.41"));
    expect(res.status).toBe(400);
    expect(provisionOwnerBusiness).not.toHaveBeenCalled();
  });
});
