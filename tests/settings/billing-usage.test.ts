import { describe, expect, it } from "vitest";
import { billingUsageToCsv } from "@/lib/settings/billing-usage";
import type { BillingUsageReport } from "@/lib/settings/billing-usage";

describe("billingUsageToCsv", () => {
  it("includes summary and agent rows", () => {
    const report: BillingUsageReport = {
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
      summary: {
        credits_topup: 100,
        credits_spent: 40,
        credits_net: 60,
        estimated_cost_myr: 8,
        ledger_entries: 2,
      },
      by_agent: [
        {
          agent_slug: "hr",
          display_name: "Hana",
          credits_charged: 25,
          cost_myr_estimated: 5,
          chat_turns: 3,
        },
      ],
      ledger: [
        {
          id: "1",
          delta: -25,
          reason: "hr.assistant.chat",
          created_at: "2026-07-15T10:00:00.000Z",
        },
      ],
    };

    const csv = billingUsageToCsv(report);
    expect(csv).toContain("credits_topup,100");
    expect(csv).toContain("hr,Hana,25");
    expect(csv).toContain("hr.assistant.chat");
  });
});
