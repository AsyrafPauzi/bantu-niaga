import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Module-level mocks. We have to swap out `@supabase/supabase-js` BEFORE
 * importing the service-role helper so the helper's `createClient` import
 * resolves to our stub.
 */

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

describe("createServiceRoleClient", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    createClientMock.mockReset();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-key-redacted";

    const { createServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    expect(() => createServiceRoleClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { createServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    expect(() => createServiceRoleClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("never includes the service-role key value in the error message", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    const { createServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    try {
      createServiceRoleClient();
      throw new Error("expected createServiceRoleClient to throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain("eyJ"); // JWT prefix never leaks
      expect(msg).toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("creates a non-persisted client when both env vars are present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-key-redacted";
    createClientMock.mockReturnValue({ marker: "service-role-client" });

    const { createServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    const client = createServiceRoleClient();

    expect(client).toEqual({ marker: "service-role-client" });
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClientMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("secret-key-redacted");
    expect(options).toMatchObject({
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  });
});

/**
 * Contract tests for upsertCustomerFromPos (Q3): the helper must reject
 * empty businessId and must scope every customer query with
 * `.eq("business_id", …)`.
 *
 * We mock both service-role and dedup so the test stays pure-logic.
 */
describe("upsertCustomerFromPos — business-id guard + scope", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.doUnmock("@/lib/supabase/service-role");
    vi.doUnmock("@/lib/marketing/dedup");
  });

  it("rejects an empty businessId before any DB call", async () => {
    const rpc = vi.fn();
    const from = vi.fn();

    vi.doMock("@/lib/supabase/service-role", () => ({
      createServiceRoleClient: () => ({ rpc, from }),
    }));
    vi.doMock("@/lib/marketing/dedup", () => ({
      dedupCustomer: vi.fn(async () => ({ action: "new" })),
    }));

    const { upsertCustomerFromPos } = await import(
      "@/lib/marketing/upsertFromPos"
    );
    await expect(
      upsertCustomerFromPos({
        phone: "+60123456789",
        name: "Ali",
        businessId: "",
      }),
    ).rejects.toThrow(/businessId is required/i);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("threads businessId through both dedup and the create RPC", async () => {
    const dedupCustomer = vi.fn(async () => ({ action: "new" as const }));
    const rpc = vi.fn(async () => ({
      data: [{ customer_id: "cust_new", event_id: "evt_new" }],
      error: null,
    }));

    vi.doMock("@/lib/supabase/service-role", () => ({
      createServiceRoleClient: () => ({ rpc, from: vi.fn() }),
    }));
    vi.doMock("@/lib/marketing/dedup", () => ({
      dedupCustomer,
    }));

    const { upsertCustomerFromPos } = await import(
      "@/lib/marketing/upsertFromPos"
    );
    const result = await upsertCustomerFromPos({
      phone: "0123456789",
      name: "Ali bin Abu",
      businessId: "biz_xyz",
    });

    expect(result).toEqual({ customerId: "cust_new", action: "new" });

    // dedup was called with the normalized phone and the correct businessId
    expect(dedupCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+60123456789",
        businessId: "biz_xyz",
        name: "Ali bin Abu",
      }),
      expect.anything(),
    );

    // RPC payload carries the businessId
    expect(rpc).toHaveBeenCalledWith(
      "marketing_create_customer",
      expect.objectContaining({
        p_business_id: "biz_xyz",
        p_phone_e164: "+60123456789",
        p_source: "pos",
      }),
    );
  });

  it("short-circuits with `merge` when dedup auto-merges (no insert)", async () => {
    const rpc = vi.fn();
    vi.doMock("@/lib/supabase/service-role", () => ({
      createServiceRoleClient: () => ({ rpc, from: vi.fn() }),
    }));
    vi.doMock("@/lib/marketing/dedup", () => ({
      dedupCustomer: vi.fn(async () => ({
        action: "merge" as const,
        existingCustomerId: "cust_existing",
        existingName: "Ali bin Abu",
      })),
    }));

    const { upsertCustomerFromPos } = await import(
      "@/lib/marketing/upsertFromPos"
    );
    const result = await upsertCustomerFromPos({
      phone: "+60123456789",
      name: "ali bin abu",
      businessId: "biz_xyz",
    });

    expect(result.action).toBe("merge");
    expect(result.customerId).toBe("cust_existing");
    expect(rpc).not.toHaveBeenCalled();
  });
});
