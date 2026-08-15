import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TENANT_AI_AGENTS } from "@/lib/settings/ai-agents-catalog";
import { creditsToMyr } from "@/lib/settings/credit-pricing";

export interface BillingUsageLedgerRow {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
}

export interface BillingUsageAgentRow {
  agent_slug: string;
  display_name: string;
  credits_charged: number;
  cost_myr_estimated: number;
  chat_turns: number;
}

export interface BillingUsageReport {
  from: string;
  to: string;
  summary: {
    credits_topup: number;
    credits_spent: number;
    credits_net: number;
    estimated_cost_myr: number;
    ledger_entries: number;
  };
  by_agent: BillingUsageAgentRow[];
  ledger: BillingUsageLedgerRow[];
}

function agentDisplayName(slug: string): string {
  return (
    TENANT_AI_AGENTS.find((a) => a.slug === slug)?.defaultName ?? slug
  );
}

export async function loadBillingUsageReport(
  businessId: string,
  fromIso: string,
  toIso: string,
  client?: SupabaseClient,
): Promise<BillingUsageReport> {
  const supabase = client ?? (await createSupabaseServerClient());

  const [ledgerRes, usageRes] = await Promise.all([
    supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .eq("business_id", businessId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("ai_usage")
      .select("agent_slug, credits_charged, cost_myr_estimated, trigger_type")
      .eq("business_id", businessId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
  ]);

  if (ledgerRes.error) throw new Error(ledgerRes.error.message);
  if (usageRes.error) throw new Error(usageRes.error.message);

  const ledger = (ledgerRes.data ?? []) as BillingUsageLedgerRow[];
  const usageRows = usageRes.data ?? [];

  let creditsTopup = 0;
  let creditsSpent = 0;
  for (const row of ledger) {
    if (row.delta > 0) creditsTopup += row.delta;
    else creditsSpent += Math.abs(row.delta);
  }

  const byAgentMap = new Map<
    string,
    { credits: number; cost: number; turns: number }
  >();
  let estimatedCost = 0;
  for (const row of usageRows) {
    const slug = String(row.agent_slug);
    const cur = byAgentMap.get(slug) ?? { credits: 0, cost: 0, turns: 0 };
    cur.credits += row.credits_charged ?? 0;
    cur.cost += Number(row.cost_myr_estimated ?? 0);
    if (row.trigger_type === "CHAT") cur.turns += 1;
    byAgentMap.set(slug, cur);
    estimatedCost += Number(row.cost_myr_estimated ?? 0);
  }

  const by_agent: BillingUsageAgentRow[] = [...byAgentMap.entries()]
    .map(([agent_slug, stats]) => ({
      agent_slug,
      display_name: agentDisplayName(agent_slug),
      credits_charged: stats.credits,
      cost_myr_estimated: Number(stats.cost.toFixed(4)),
      chat_turns: stats.turns,
    }))
    .sort((a, b) => b.credits_charged - a.credits_charged);

  return {
    from: fromIso,
    to: toIso,
    summary: {
      credits_topup: creditsTopup,
      credits_spent: creditsSpent,
      credits_net: creditsTopup - creditsSpent,
      estimated_cost_myr: Number(estimatedCost.toFixed(4)),
      ledger_entries: ledger.length,
    },
    by_agent,
    ledger,
  };
}

export function billingUsageToCsv(report: BillingUsageReport): string {
  const lines: string[] = [
    "NiagaX — Usage billing report",
    `Period,${report.from},${report.to}`,
    "",
    "Summary",
    "metric,value",
    `credits_topup,${report.summary.credits_topup}`,
    `credits_spent,${report.summary.credits_spent}`,
    `credits_net,${report.summary.credits_net}`,
    `estimated_cost_myr,${report.summary.estimated_cost_myr}`,
    "",
    "By agent",
    "agent_slug,display_name,credits_charged,cost_myr_estimated,chat_turns",
    ...report.by_agent.map(
      (a) =>
        `${a.agent_slug},${a.display_name},${a.credits_charged},${a.cost_myr_estimated},${a.chat_turns}`,
    ),
    "",
    "Credit ledger",
    "created_at,delta,reason",
    ...report.ledger.map(
      (r) =>
        `${r.created_at},${r.delta},"${String(r.reason).replace(/"/g, '""')}"`,
    ),
  ];
  return lines.join("\n");
}

export function creditsSpentMyr(credits: number): number {
  return creditsToMyr(credits);
}
