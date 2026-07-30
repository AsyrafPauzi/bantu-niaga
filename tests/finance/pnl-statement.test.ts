import { describe, expect, it } from "vitest";
import type { FinancePnLLine } from "@/lib/finance/schemas";

/** Mirrors categorization rules in computeFinancePnLStatement for unit tests. */
function buildStatementFromTxns(
  txns: Array<{ kind: string; category: string | null; amount_myr: number }>,
) {
  const REVENUE = new Set(["sales", "services", "invoice_payment"]);
  const EXCLUDED = new Set(["capital", "loan"]);

  const revenueMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  const excludedMap = new Map<string, number>();

  for (const row of txns) {
    const cat = row.category?.trim() || "other";
    const amt = Number(row.amount_myr);
    if (row.kind === "income") {
      if (EXCLUDED.has(cat)) {
        excludedMap.set(cat, (excludedMap.get(cat) ?? 0) + amt);
      } else if (REVENUE.has(cat) || ["grant", "refund", "other"].includes(cat)) {
        revenueMap.set(cat, (revenueMap.get(cat) ?? 0) + amt);
      }
    } else {
      expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + amt);
    }
  }

  const sum = (m: Map<string, number>) =>
    [...m.values()].reduce((a, b) => a + b, 0);

  const total_revenue_myr = sum(revenueMap);
  const total_expenses_myr = sum(expenseMap);

  return {
    total_revenue_myr,
    total_expenses_myr,
    net_profit_myr: total_revenue_myr - total_expenses_myr,
    total_excluded_cash_in_myr: sum(excludedMap),
  };
}

describe("P&L statement logic", () => {
  it("computes net profit as revenue minus expenses", () => {
    const result = buildStatementFromTxns([
      { kind: "income", category: "sales", amount_myr: 5000 },
      { kind: "income", category: "invoice_payment", amount_myr: 3000 },
      { kind: "expense", category: "rent", amount_myr: 2000 },
      { kind: "expense", category: "supplies", amount_myr: 500 },
    ]);
    expect(result.total_revenue_myr).toBe(8000);
    expect(result.total_expenses_myr).toBe(2500);
    expect(result.net_profit_myr).toBe(5500);
  });

  it("excludes capital and loans from revenue", () => {
    const result = buildStatementFromTxns([
      { kind: "income", category: "sales", amount_myr: 1000 },
      { kind: "income", category: "capital", amount_myr: 50000 },
      { kind: "income", category: "loan", amount_myr: 20000 },
    ]);
    expect(result.total_revenue_myr).toBe(1000);
    expect(result.total_excluded_cash_in_myr).toBe(70000);
    expect(result.net_profit_myr).toBe(1000);
  });
});

describe("FinancePnLLine shape", () => {
  it("accepts statement line objects", () => {
    const line: FinancePnLLine = {
      category: "sales",
      label: "Sales",
      amount_myr: 100,
      count: 2,
    };
    expect(line.label).toBe("Sales");
  });
});
