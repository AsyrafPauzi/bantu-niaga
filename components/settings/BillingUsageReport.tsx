"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, BarChart3 } from "lucide-react";
import type { BillingUsageReport } from "@/lib/settings/billing-usage";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function BillingUsageReport() {
  const [report, setReport] = useState<BillingUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/billing/usage");
      const json = (await res.json()) as BillingUsageReport & {
        message?: string;
      };
      if (!res.ok) {
        setError(json.message ?? "Could not load usage report");
        return;
      }
      setReport(json);
    } catch {
      setError("Could not load usage report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadCsv() {
    setDownloading(true);
    try {
      const res = await fetch("/api/settings/billing/usage?format=csv");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bantuniaga-usage-report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-200">
            <BarChart3 className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-ink dark:text-cream-100">
              Usage-based billing report
            </h3>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Fast Credits top-ups, AI spend, and ledger activity this month.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void downloadCsv()}
          disabled={downloading || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-100"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Download CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-status-danger">{error}</p>
      ) : report ? (
        <div className="space-y-4 p-5">
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {fmtDate(report.from)} — {fmtDate(report.to)}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-cream-50 p-3 dark:bg-hairline-dark/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Top-ups
              </p>
              <p className="mt-1 text-lg font-bold text-status-success">
                +{report.summary.credits_topup}
              </p>
            </div>
            <div className="rounded-lg bg-cream-50 p-3 dark:bg-hairline-dark/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Spent
              </p>
              <p className="mt-1 text-lg font-bold text-ink dark:text-cream-100">
                −{report.summary.credits_spent}
              </p>
            </div>
            <div className="rounded-lg bg-cream-50 p-3 dark:bg-hairline-dark/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Net
              </p>
              <p className="mt-1 text-lg font-bold text-ink dark:text-cream-100">
                {report.summary.credits_net >= 0 ? "+" : ""}
                {report.summary.credits_net}
              </p>
            </div>
            <div className="rounded-lg bg-cream-50 p-3 dark:bg-hairline-dark/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Est. cost
              </p>
              <p className="mt-1 text-lg font-bold text-ink dark:text-cream-100">
                RM {report.summary.estimated_cost_myr.toFixed(2)}
              </p>
            </div>
          </div>

          {report.by_agent.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="py-2 text-left">Agent</th>
                    <th className="py-2 text-right">Credits</th>
                    <th className="py-2 text-right">Chats</th>
                    <th className="py-2 text-right">Est. MYR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                  {report.by_agent.map((a) => (
                    <tr key={a.agent_slug}>
                      <td className="py-2 font-medium text-ink dark:text-cream-100">
                        {a.display_name}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {a.credits_charged}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {a.chat_turns}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {a.cost_myr_estimated.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No AI usage recorded this period.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
