import Link from "next/link";
import { Send, Sparkles, Users } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TagBadge } from "@/components/marketing/TagBadge";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import type { SegmentMemberRow, SegmentRow } from "@/lib/marketing/segments";
import {
  AUTO_KEY_LABEL,
  type AutoSegmentKey,
} from "@/lib/marketing/segments-rules";
import {
  buildSegmentRuleSummary,
  broadcastNewHref,
  fmtSegmentRel,
  segmentCustomersHref,
} from "@/lib/marketing/segment-display";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";
import { segmentDetailSubpageHero } from "@/lib/marketing/subpage-hero";
import { SegmentDetailEditButton } from "@/components/marketing/SegmentDetailEditButton";

const AUTO_TONE: Record<
  AutoSegmentKey,
  "accent" | "brand" | "success" | "warning" | "neutral"
> = {
  vip: "accent",
  repeat: "brand",
  new: "success",
  at_risk: "warning",
  dormant: "neutral",
};

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtPurchaseRel(iso: string | null): string {
  if (!iso) return "Never";
  return fmtSegmentRel(iso).replace("Not refreshed yet", "Never");
}

interface SegmentDetailViewProps {
  segment: SegmentRow;
  memberCount: number;
  members: SegmentMemberRow[];
  hasMoreMembers: boolean;
  openEditOnLoad?: boolean;
}

export function SegmentDetailView({
  segment,
  memberCount,
  members,
  hasMoreMembers,
  openEditOnLoad = false,
}: SegmentDetailViewProps) {
  const hero = segmentDetailSubpageHero({
    name: segment.name,
    kind: segment.kind,
    autoKey: segment.auto_key,
    memberCount,
  });

  const ruleRows = buildSegmentRuleSummary(segment);
  const avgSpend =
    members.length > 0
      ? members.reduce((s, m) => s + Number(m.total_spend_myr) || 0, 0) /
        members.length
      : 0;

  const tone =
    segment.kind === "auto" && segment.auto_key
      ? AUTO_TONE[segment.auto_key]
      : "accent";

  return (
    <div className="space-y-6 pb-8">
      <ModuleDashboardHero
        module="Marketing · Segments"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
        headerExtra={
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {segment.kind === "auto" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                <Sparkles className="h-3 w-3" strokeWidth={2} />
                Built-in
              </span>
            ) : (
              <StatusPill tone="accent">Custom</StatusPill>
            )}
            {segment.kind === "auto" && segment.auto_key ? (
              <StatusPill tone={tone}>
                {AUTO_KEY_LABEL[segment.auto_key]}
              </StatusPill>
            ) : null}
          </div>
        }
        cta={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {memberCount > 0 ? (
              <Link
                href={broadcastNewHref(segment.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
                Send broadcast
              </Link>
            ) : null}
            {segment.kind === "auto" && segment.auto_key ? (
              <Link
                href={segmentCustomersHref(segment.auto_key)}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:text-violet-200"
              >
                View in CRM
              </Link>
            ) : segment.kind === "custom" ? (
              <SegmentDetailEditButton
                segment={segment}
                defaultOpen={openEditOnLoad}
              />
            ) : null}
          </div>
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Members"
            value={formatCount(memberCount)}
            icon={<Users />}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Avg spend"
            value={members.length > 0 ? formatMyr(avgSpend) : "—"}
            hint={members.length > 0 ? "in this sample" : "no members yet"}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Shown here"
            value={formatCount(members.length)}
            hint={hasMoreMembers ? "first page" : "full list"}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Refreshed"
            value={fmtSegmentRel(segment.member_count_at)}
            hint="member count"
            iconClassName="text-amber-700 dark:text-amber-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:items-start">
        <aside className="space-y-4 lg:order-2">
          <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              How members are chosen
            </p>
            <dl className="mt-3 space-y-3 text-sm">
              {ruleRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-ink-muted dark:text-cream-400">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-ink dark:text-cream-100">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {segment.kind === "auto" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Built-in segment
              </p>
              <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
                Membership follows auto-tags on customers. Refresh tags from the
                customers list, or open CRM to view who matches.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-cream-200 bg-cream-50/80 p-4 dark:border-hairline-dark dark:bg-hairline-dark/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                Manage segment
              </p>
              <p className="mt-2 text-sm text-ink-muted dark:text-cream-400">
                Edit rules or remove this segment from the header actions.
              </p>
            </div>
          )}
        </aside>

        <section className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark lg:col-span-2 lg:order-1">
          <div className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Members
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {memberCount === 0
                ? "Nobody matches this segment right now."
                : `Showing ${formatCount(members.length)} of ${formatCount(memberCount)}`}
            </p>
          </div>

          {members.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                No members yet
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                {segment.kind === "auto"
                  ? "Customers will appear when auto-tags match this group."
                  : "Adjust your rules or add customers that fit."}
              </p>
              {segment.kind === "auto" && segment.auto_key ? (
                <Link
                  href={segmentCustomersHref(segment.auto_key)}
                  className="mt-4 inline-flex rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  Browse CRM by tag
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                    <tr>
                      <th className="px-5 py-3 text-left">Customer</th>
                      <th className="px-3 py-3 text-left">Tags</th>
                      <th className="px-3 py-3 text-right">Spend</th>
                      <th className="px-5 py-3 text-right">Last purchase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                    {members.map((m) => (
                      <tr
                        key={m.id}
                        className="hover:bg-cream-50 dark:hover:bg-hairline-dark/30"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/marketing/customers/${m.id}`}
                            className="flex items-center gap-3"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[10px] font-bold uppercase text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                              {customerInitials(m.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink hover:text-violet-700 dark:text-cream-100">
                                {m.name}
                              </p>
                              <p className="text-xs text-ink-muted dark:text-cream-400">
                                {m.phone_e164 ?? "no phone"}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {m.auto_tags.slice(0, 2).map((t) => (
                              <TagBadge key={`a-${m.id}-${t}`} label={t} kind="auto" />
                            ))}
                            {m.manual_tags.slice(0, 1).map((t) => (
                              <TagBadge key={`m-${m.id}-${t}`} label={t} kind="manual" />
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {formatMyr(m.total_spend_myr)}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                          {fmtPurchaseRel(m.last_purchase_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-cream-200 lg:hidden dark:divide-hairline-dark">
                {members.map((m) => (
                  <Link
                    key={m.id}
                    href={`/marketing/customers/${m.id}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold uppercase text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                      {customerInitials(m.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                        {m.name}
                      </p>
                      <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                        {m.phone_e164 ?? "no phone"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMyr(m.total_spend_myr)}
                      </p>
                      <p className="text-[10px] text-ink-muted dark:text-cream-400">
                        {fmtPurchaseRel(m.last_purchase_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {hasMoreMembers ? (
            <div className="border-t border-cream-200 bg-cream-50/60 px-4 py-3 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/20 dark:text-cream-400 sm:px-5">
              Showing the first {members.length} members. Open individual
              profiles from the list, or use{" "}
              {segment.kind === "auto" && segment.auto_key ? (
                <Link
                  href={segmentCustomersHref(segment.auto_key)}
                  className="font-semibold text-violet-700 hover:underline dark:text-violet-300"
                >
                  CRM tag filter
                </Link>
              ) : (
                <span>broadcast</span>
              )}{" "}
              for the full audience.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
