import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  PageBody,
  KpiCard,
  Section,
  StatusPill,
  formatMyr,
  formatInt,
} from "@/components/super-admin/primitives";
import {
  EMAIL_COGS_WARN_MRR_RATIO,
  RESEND_COGS_PER_EMAIL_MYR,
} from "@/lib/settings/email-usage-metering";
import type { EmailCogsRow, EmailCogsSummary } from "@/app/api/super-admin/analytics/email-cogs/route";

export const dynamic = "force-dynamic";

/** YYYY-MM key for the current calendar month. */
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

async function loadEmailCogsData(): Promise<{
  summary: EmailCogsSummary;
  flagged: EmailCogsRow[];
}> {
  const month = currentMonthKey();
  const svc = createServiceRoleClient();

  const { data: rows, error } = await svc
    .from("business_usage_monthly")
    .select(
      "business_id, emails_sent, email_cogs_myr, plan_mrr_myr, guardrail_status",
    )
    .eq("month", month)
    .limit(5000);

  if (error) {
    throw new Error("Failed to load email usage data.");
  }

  const businessIds = (rows ?? []).map((r) => r.business_id as string);
  const nameMap = new Map<string, string | null>();

  if (businessIds.length > 0) {
    const { data: businesses } = await svc
      .from("businesses")
      .select("id, name")
      .in("id", businessIds);

    for (const b of businesses ?? []) {
      nameMap.set(b.id as string, (b.name as string | null) ?? null);
    }
  }

  let totalEmailsSent = 0;
  let totalEmailCogsMyr = 0;
  let countOk = 0;
  let countWarn = 0;
  let countThrottled = 0;
  const flagged: EmailCogsRow[] = [];

  for (const row of rows ?? []) {
    const sent = Number(row.emails_sent ?? 0);
    const cogs = Number(row.email_cogs_myr ?? 0);
    const status = (row.guardrail_status as string | null) ?? "ok";

    totalEmailsSent += sent;
    totalEmailCogsMyr += cogs;

    if (status === "warn") countWarn++;
    else if (status === "throttled") countThrottled++;
    else countOk++;

    if (status !== "ok") {
      flagged.push({
        business_id: row.business_id as string,
        business_name: nameMap.get(row.business_id as string) ?? null,
        emails_sent: sent,
        email_cogs_myr: cogs,
        plan_mrr_myr:
          row.plan_mrr_myr != null ? Number(row.plan_mrr_myr) : null,
        guardrail_status: status,
        month,
      });
    }
  }

  flagged.sort((a, b) => b.email_cogs_myr - a.email_cogs_myr);

  return {
    summary: {
      month,
      total_emails_sent: totalEmailsSent,
      total_email_cogs_myr: Math.round(totalEmailCogsMyr * 100) / 100,
      businesses_ok: countOk,
      businesses_warn: countWarn,
      businesses_throttled: countThrottled,
      businesses_flagged: countWarn + countThrottled,
    },
    flagged,
  };
}

function statusPillTone(
  status: string,
): "success" | "warning" | "danger" | "muted" {
  if (status === "throttled") return "danger";
  if (status === "warn") return "warning";
  return "muted";
}

function cogsRatioLabel(row: EmailCogsRow): string {
  if (!row.plan_mrr_myr || row.plan_mrr_myr === 0) return "—";
  const ratio = (row.email_cogs_myr / row.plan_mrr_myr) * 100;
  return `${ratio.toFixed(1)}% of MRR`;
}

export default async function EmailCogsPage() {
  await requirePlatformAdmin();

  const { summary, flagged } = await loadEmailCogsData();

  const warnThresholdPct = Math.round(EMAIL_COGS_WARN_MRR_RATIO * 100);
  const cogsPerEmail = RESEND_COGS_PER_EMAIL_MYR;

  return (
    <>
      <PageTopbar
        title="Email COGS guardrail"
        subtitle={`Platform-wide outbound email cost rollup — ${summary.month}`}
        right={
          <Link
            href="/super-admin/revenue"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            ← Revenue overview
          </Link>
        }
      />

      <PageBody>
        {/* KPI summary cards */}
        <div className="flex flex-wrap gap-4">
          <KpiCard
            label="Total emails sent this month"
            value={formatInt(summary.total_emails_sent)}
            trend="flat"
            subtle={`${summary.month}`}
          />
          <KpiCard
            label="Total email COGS (MYR)"
            value={formatMyr(summary.total_email_cogs_myr)}
            trend={summary.total_email_cogs_myr > 0 ? "up" : "flat"}
            subtle={`${cogsPerEmail.toFixed(3)} MYR / email`}
          />
          <KpiCard
            label="Businesses flagged"
            value={String(summary.businesses_flagged)}
            trend={summary.businesses_flagged > 0 ? "down" : "flat"}
            delta={
              summary.businesses_flagged > 0
                ? `${summary.businesses_warn} warn · ${summary.businesses_throttled} throttled`
                : undefined
            }
            subtle={`${summary.businesses_ok} ok`}
          />
        </div>

        {/* Guardrail threshold reference */}
        <Section
          title="Guardrail thresholds"
          description="These rules apply to all paid-tier businesses. Free-tier businesses have a hard email cap with no COGS tracking."
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-200">
                <th className="pb-2 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">
                  Status
                </th>
                <th className="pb-2 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">
                  Trigger condition
                </th>
                <th className="pb-2 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">
                  Platform action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              <tr>
                <td className="py-2.5 pr-4">
                  <StatusPill tone="success" label="ok" />
                </td>
                <td className="py-2.5 pr-4 text-ink-muted">
                  Email COGS &lt; {warnThresholdPct}% of plan MRR
                </td>
                <td className="py-2.5 text-ink-muted">None</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4">
                  <StatusPill tone="warning" label="warn" />
                </td>
                <td className="py-2.5 pr-4 text-ink-muted">
                  Email COGS ≥ {warnThresholdPct}% of plan MRR (
                  <code className="text-xs bg-cream-100 px-1 rounded">
                    email_cogs_myr / plan_mrr_myr ≥ {EMAIL_COGS_WARN_MRR_RATIO}
                  </code>
                  )
                </td>
                <td className="py-2.5 text-ink-muted">
                  Server-side warning logged (v1: warn-only, no rate limit)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4">
                  <StatusPill tone="danger" label="throttled" />
                </td>
                <td className="py-2.5 pr-4 text-ink-muted">
                  Reserved — manual operator override
                </td>
                <td className="py-2.5 text-ink-muted">
                  Future: outbound email paused for the business
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-muted">
            Cost basis:{" "}
            <strong>MYR {cogsPerEmail.toFixed(3)}</strong> per outbound email
            (Resend variable cost). Tracked in{" "}
            <code className="text-xs bg-cream-100 px-1 rounded">
              business_usage_monthly
            </code>
            , column{" "}
            <code className="text-xs bg-cream-100 px-1 rounded">
              email_cogs_myr
            </code>
            .
          </p>
        </Section>

        {/* Flagged businesses table */}
        <Section
          title={`Flagged businesses (${summary.businesses_flagged})`}
          description={
            summary.businesses_flagged === 0
              ? "No businesses are outside the ok guardrail range this month."
              : "Businesses with guardrail_status of warn or throttled this month, sorted by COGS descending."
          }
          right={
            summary.businesses_flagged > 0 ? (
              <span className="text-xs text-ink-muted">
                Showing all {summary.businesses_flagged} flagged
              </span>
            ) : undefined
          }
        >
          {summary.businesses_flagged === 0 ? (
            <p className="text-sm text-ink-muted py-4 text-center">
              All businesses are within the guardrail threshold this month.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200">
                    <th className="px-5 pb-2 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      Business
                    </th>
                    <th className="px-5 pb-2 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-5 pb-2 text-right text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      Emails sent
                    </th>
                    <th className="px-5 pb-2 text-right text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      Email COGS
                    </th>
                    <th className="px-5 pb-2 text-right text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      COGS / MRR
                    </th>
                    <th className="px-5 pb-2 text-left text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {flagged.map((row) => (
                    <tr key={row.business_id} className="hover:bg-cream-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink leading-tight">
                          {row.business_name ?? (
                            <span className="text-ink-muted italic">
                              Unnamed
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-muted font-mono mt-0.5">
                          {row.business_id}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill
                          tone={statusPillTone(row.guardrail_status)}
                          label={row.guardrail_status}
                        />
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {formatInt(row.emails_sent)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">
                        {formatMyr(row.email_cogs_myr)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-ink-muted">
                        {cogsRatioLabel(row)}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/super-admin/businesses/${row.business_id}`}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline"
                        >
                          View business →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}
