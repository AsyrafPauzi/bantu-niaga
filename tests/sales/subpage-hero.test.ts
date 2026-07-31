import { describe, expect, it } from "vitest";
import { leadsSubpageHero, historySubpageHero } from "@/lib/sales/subpage-hero";

describe("leadsSubpageHero", () => {
  it("shows empty state when no open leads", () => {
    const hero = leadsSubpageHero({
      open: 0,
      overdue: 0,
      dueToday: 0,
      won: 0,
      lost: 0,
      pipelineValueMyr: 0,
      topChannel: null,
    });
    expect(hero.headline).toContain("Start");
    expect(hero.variant).toBe("calm");
  });

  it("prioritises overdue in headline", () => {
    const hero = leadsSubpageHero({
      open: 5,
      overdue: 2,
      dueToday: 0,
      won: 0,
      lost: 0,
      pipelineValueMyr: 100,
      topChannel: "whatsapp",
    });
    expect(hero.headline).toContain("2");
    expect(hero.variant).toBe("attention");
  });
});

describe("historySubpageHero", () => {
  it("formats period totals", () => {
    const hero = historySubpageHero({
      period: "today",
      salesMyr: 150,
      txnCount: 3,
    });
    expect(hero.headline).toContain("RM");
    expect(hero.subcopy).toContain("3");
  });
});
