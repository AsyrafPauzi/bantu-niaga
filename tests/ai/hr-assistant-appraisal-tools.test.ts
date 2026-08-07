import { describe, expect, it } from "vitest";
import {
  executeCreateStaffAppraisal,
  executeCompleteStaffAppraisal,
} from "@/lib/ai/hr-assistant-tools";
import type { AgentContext } from "@/lib/ai/context/types";

const ctx: AgentContext = {
  businessId: "biz-1",
  userId: "user-1",
  role: "owner",
  impersonated: false,
};

describe("Hana appraisal tools", () => {
  it("rejects invalid create args", async () => {
    const result = await executeCreateStaffAppraisal(ctx, {
      employee_name: "Ahmad",
      period_label: "2026",
      due_date: "bad-date",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.action).toBe("create_staff_appraisal");
    }
  });

  it("rejects invalid complete args", async () => {
    const result = await executeCompleteStaffAppraisal(ctx, {
      employee_name: "Ahmad",
      rating: 9,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.action).toBe("complete_staff_appraisal");
    }
  });
});
