import { describe, expect, it, vi } from "vitest";
import { dedupCustomer, normalizeName, FUZZY_NAME_THRESHOLD } from "@/lib/marketing/dedup";

/**
 * Tiny in-memory stub of the subset of the Supabase JS client used by
 * `dedupCustomer`:
 *
 *   supabase.from("customers")
 *     .select("id, name")
 *     .eq("business_id", …)
 *     .eq("phone_e164", …)
 *     .is("merged_into_id", null)
 *     .is("deleted_at", null)
 *     .limit(1)
 *     .maybeSingle()        → { data, error }
 *
 *   supabase.rpc("marketing_name_similarity", { a, b }) → { data, error }
 */
function makeStubClient(opts: {
  phoneLookup?: { data: { id: string; name: string } | null; error?: Error | null };
  similarity?: number;
  trackQuery?: (calls: { table: string; eqs: Array<[string, unknown]>; iss: Array<[string, unknown]> }) => void;
}) {
  const lookup = opts.phoneLookup ?? { data: null, error: null };
  const calls = { table: "", eqs: [] as Array<[string, unknown]>, iss: [] as Array<[string, unknown]> };

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(function (this: typeof builder, col: string, val: unknown) {
      calls.eqs.push([col, val]);
      return this;
    }),
    is: vi.fn(function (this: typeof builder, col: string, val: unknown) {
      calls.iss.push([col, val]);
      return this;
    }),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(lookup),
  };

  const client = {
    from: vi.fn((table: string) => {
      calls.table = table;
      return builder;
    }),
    rpc: vi
      .fn()
      .mockImplementation(async (name: string, _args: Record<string, unknown>) => {
        if (name === "marketing_name_similarity") {
          return { data: opts.similarity ?? 0, error: null };
        }
        return { data: null, error: new Error(`unmocked rpc ${name}`) };
      }),
  };

  if (opts.trackQuery) opts.trackQuery(calls);
  return { client, builder, calls };
}

describe("normalizeName", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeName("  Ali   bin   Abu  ")).toBe("ali bin abu");
  });
});

describe("dedupCustomer", () => {
  it("returns `new` when no phone is provided", async () => {
    const { client } = makeStubClient({});
    const result = await dedupCustomer(
      { phone: null, name: "Ali", businessId: "biz_a" },
      client as never,
    );
    expect(result).toEqual({ action: "new" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns `new` when phone is provided but matches nothing", async () => {
    const { client } = makeStubClient({
      phoneLookup: { data: null, error: null },
    });
    const result = await dedupCustomer(
      { phone: "+60123456789", name: "Ali", businessId: "biz_a" },
      client as never,
    );
    expect(result).toEqual({ action: "new" });
    expect(client.from).toHaveBeenCalledWith("customers");
  });

  it("always tenant-scopes the lookup with business_id", async () => {
    let captured: { eqs: Array<[string, unknown]>; iss: Array<[string, unknown]> } | undefined;
    const { client } = makeStubClient({
      phoneLookup: { data: null, error: null },
      trackQuery: (c) => {
        captured = c;
      },
    });
    await dedupCustomer(
      { phone: "+60123456789", name: "Ali", businessId: "biz_a" },
      client as never,
    );
    expect(captured?.eqs).toContainEqual(["business_id", "biz_a"]);
    expect(captured?.eqs).toContainEqual(["phone_e164", "+60123456789"]);
    expect(captured?.iss).toContainEqual(["merged_into_id", null]);
    expect(captured?.iss).toContainEqual(["deleted_at", null]);
  });

  it("returns `merge` when names match exactly (no similarity rpc needed)", async () => {
    const { client } = makeStubClient({
      phoneLookup: { data: { id: "cust_1", name: "Ali bin Abu" }, error: null },
    });
    const result = await dedupCustomer(
      { phone: "+60123456789", name: "ali bin abu", businessId: "biz_a" },
      client as never,
    );
    expect(result).toEqual({
      action: "merge",
      existingCustomerId: "cust_1",
      existingName: "Ali bin Abu",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns `merge` when names diverge but pg_trgm similarity ≥ threshold", async () => {
    const { client } = makeStubClient({
      phoneLookup: { data: { id: "cust_2", name: "Ali bin Abu" }, error: null },
      similarity: FUZZY_NAME_THRESHOLD + 0.1,
    });
    const result = await dedupCustomer(
      { phone: "+60123456789", name: "Ali B. Abu", businessId: "biz_a" },
      client as never,
    );
    expect(result.action).toBe("merge");
    expect(result.existingCustomerId).toBe("cust_2");
  });

  it("returns `prompt` when names diverge and similarity is below threshold", async () => {
    const { client } = makeStubClient({
      phoneLookup: { data: { id: "cust_3", name: "Ali bin Abu" }, error: null },
      similarity: 0.1,
    });
    const result = await dedupCustomer(
      { phone: "+60123456789", name: "Siti Sara", businessId: "biz_a" },
      client as never,
    );
    expect(result).toEqual({
      action: "prompt",
      existingCustomerId: "cust_3",
      existingName: "Ali bin Abu",
    });
  });

  it("throws on missing businessId", async () => {
    const { client } = makeStubClient({});
    await expect(
      dedupCustomer(
        { phone: "+60123456789", name: "Ali", businessId: "" },
        client as never,
      ),
    ).rejects.toThrow(/businessId is required/i);
  });
});
