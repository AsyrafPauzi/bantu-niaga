import { describe, expect, it } from "vitest";
import { ownerProvisionPlan } from "@/lib/auth/provision-owner-business";

describe("ownerProvisionPlan", () => {
  it("maps free to starter active without credits", () => {
    const plan = ownerProvisionPlan("free");
    expect(plan.tier).toBe("starter");
    expect(plan.subscriptionStatus).toBe("active");
    expect(plan.grantCredits).toBe(false);
    expect(plan.trialDays).toBe(0);
  });

  it("maps starter_trial to micro trial with credits", () => {
    const plan = ownerProvisionPlan("starter_trial");
    expect(plan.tier).toBe("micro");
    expect(plan.subscriptionStatus).toBe("trial");
    expect(plan.grantCredits).toBe(true);
    expect(plan.trialDays).toBe(14);
  });
});
