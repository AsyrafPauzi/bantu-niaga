import { describe, expect, it } from "vitest";
import {
  aggregateBoardroomLedgerRows,
  buildDailySparkline,
  tenantAgentToRow,
} from "@/lib/super-admin/agent-usage-dashboard";
import { TENANT_AI_AGENTS } from "@/lib/settings/ai-agents-catalog";

describe("platform agent usage dashboard", () => {
  it("builds 7-day sparkline with zero-filled gaps", () => {
    const today = new Date().toISOString().slice(0, 10);
    const values = buildDailySparkline([{ day: today, invocations: 4 }]);
    expect(values).toHaveLength(7);
    expect(values[6]).toBe(4);
    expect(values.slice(0, 6).every((v) => v === 0)).toBe(true);
  });

  it("aggregates boardroom credit_ledger rows", () => {
    const today = new Date().toISOString();
    const stats = aggregateBoardroomLedgerRows([
      { delta: -1, created_at: today },
      { delta: -3, created_at: today },
    ]);
    expect(stats.invocations).toBe(2);
    expect(stats.credits).toBe(4);
    expect(stats.spend_myr).toBe(0.4);
  });

  it("maps tenant catalog agents to platform rows", () => {
    const marketing = TENANT_AI_AGENTS.find((a) => a.slug === "marketing")!;
    const row = tenantAgentToRow(marketing);
    expect(row.slug).toBe("marketing");
    expect(row.name).toBe("Maya");
    expect(row.default_model).toBe("ilmu-mini-v3.3");
  });

  it("uses nemo-super for boardroom default model", () => {
    const boardroom = TENANT_AI_AGENTS.find((a) => a.slug === "boardroom")!;
    expect(tenantAgentToRow(boardroom).default_model).toBe("nemo-super");
  });
});
