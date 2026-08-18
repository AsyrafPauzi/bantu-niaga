import { describe, expect, it, vi } from "vitest";

describe("grantBasicTrialCredits", () => {
  it("grants BASIC_TRIAL_CREDITS with reason basic_trial_grant", async () => {
    vi.resetModules();
    const rpc = vi.fn(async () => ({ data: 20, error: null }));
    vi.doMock("@/lib/ai/credits", () => ({ grantCredits: vi.fn() }));
    const { grantBasicTrialCredits } = await import(
      "@/lib/settings/subscription-credits"
    );
    const { BASIC_TRIAL_CREDITS } = await import(
      "@/lib/settings/subscription-billing"
    );
    const client = { rpc };
    const balance = await grantBasicTrialCredits("biz-1", "user-1", client as never);
    expect(balance).toBe(20);
    expect(BASIC_TRIAL_CREDITS).toBe(20);
    expect(rpc).toHaveBeenCalledWith("settings_grant_credits", {
      p_business_id: "biz-1",
      p_credits: 20,
      p_reason: "basic_trial_grant",
      p_actor_user_id: "user-1",
    });
  });
});
