import { describe, expect, it, vi } from "vitest";
import { touchCustomerLastContacted } from "@/lib/marketing/last-contacted";

describe("touchCustomerLastContacted", () => {
  it("updates last_contacted_at for the business-scoped customer", async () => {
    const finalIs = vi.fn().mockResolvedValue({ error: null });
    const firstIs = vi.fn(() => ({ is: finalIs }));
    const secondEq = vi.fn(() => ({ is: firstIs }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ update }));

    const supabase = { from };

    await touchCustomerLastContacted(
      supabase as never,
      "biz-1",
      "cust-1",
      new Date("2026-08-20T12:00:00.000Z"),
    );

    expect(from).toHaveBeenCalledWith("customers");
    expect(update).toHaveBeenCalledWith({
      last_contacted_at: "2026-08-20T12:00:00.000Z",
    });
    expect(firstEq).toHaveBeenCalledWith("business_id", "biz-1");
    expect(secondEq).toHaveBeenCalledWith("id", "cust-1");
  });

  it("throws when supabase returns an error", async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                is: vi.fn().mockResolvedValue({
                  error: { message: "boom" },
                }),
              })),
            })),
          })),
        })),
      })),
    };

    await expect(
      touchCustomerLastContacted(supabase as never, "biz-1", "cust-1"),
    ).rejects.toThrow("boom");
  });
});
