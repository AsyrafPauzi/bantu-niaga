import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recomputeMemberCount,
  resolveSegmentMembers,
  SegmentNotFoundError,
  MemberCountUpdateError,
  type SegmentRow,
} from "@/lib/marketing/segments";
import { formatMyr } from "@/lib/marketing/metrics";
import { AUTO_KEY_LABEL } from "@/lib/marketing/segments-rules";
import { SegmentDetailEditButton } from "./detail-edit";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Segment ${id.slice(0, 8)}` };
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

function ruleSummaryRows(segment: SegmentRow): { label: string; value: string }[] {
  if (segment.kind === "auto" && segment.auto_key) {
    return [
      { label: "Type", value: "Auto-segment" },
      { label: "Auto key", value: segment.auto_key },
      { label: "Friendly label", value: AUTO_KEY_LABEL[segment.auto_key] },
      {
        label: "How it's computed",
        value:
          "Membership mirrors the `customers.auto_tags` array. Recomputed nightly by the auto-tag worker.",
      },
    ];
  }

  const rules = segment.rules ?? {};
  const rows: { label: string; value: string }[] = [
    { label: "Type", value: "Custom segment" },
  ];
  if (rules.tags_any && rules.tags_any.length > 0) {
    rows.push({ label: "Has any tag", value: rules.tags_any.join(", ") });
  }
  if (typeof rules.min_spend_myr === "number") {
    rows.push({ label: "Min total spend", value: formatMyr(rules.min_spend_myr) });
  }
  if (typeof rules.max_spend_myr === "number") {
    rows.push({ label: "Max total spend", value: formatMyr(rules.max_spend_myr) });
  }
  if (typeof rules.inactive_days === "number") {
    rows.push({
      label: "Inactive for",
      value: `${rules.inactive_days}+ days (or never purchased)`,
    });
  }
  if (rules.sources && rules.sources.length > 0) {
    rows.push({ label: "Source", value: rules.sources.join(", ") });
  }
  if (rules.manual_tags_any && rules.manual_tags_any.length > 0) {
    rows.push({
      label: "Manual tags",
      value: rules.manual_tags_any.join(", "),
    });
  }
  if (rules.auto_tags_any && rules.auto_tags_any.length > 0) {
    rows.push({
      label: "Auto tags",
      value: rules.auto_tags_any.join(", "),
    });
  }
  if (rows.length === 1) {
    rows.push({
      label: "Rules",
      value: "No filters — matches every active customer.",
    });
  }
  return rows;
}

export default async function SegmentDetailPage({ params }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }
  if (!canSurface(user.role, "marketing", "segments")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing segments.
          </p>
        </CardBody>
      </Card>
    );
  }

  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  let segment: SegmentRow;
  let memberCount: number;
  try {
    const result = await recomputeMemberCount(supabase, id);
    segment = result.segment;
    memberCount = result.count;
  } catch (e) {
    if (e instanceof SegmentNotFoundError) notFound();
    if (e instanceof MemberCountUpdateError) {
      // RLS denied the UPDATE (auto row) — fall back to a plain read +
      // the freshly-counted number.
      memberCount = e.count;
      const { data: row } = await supabase
        .from("customer_segments")
        .select(
          "id, business_id, name, kind, auto_key, rules, member_count, member_count_at, created_by, created_at, updated_at, deleted_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (!row) notFound();
      segment = row as SegmentRow;
    } else {
      throw e;
    }
  }

  const memberPage = await resolveSegmentMembers(supabase, id, { limit: 25 });

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/segments"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to Segments
      </Link>

      <PageHeader
        eyebrow="Marketing · Segments"
        title={segment.name}
        description={
          segment.kind === "auto"
            ? "Auto-segment — membership is computed nightly from the customers table."
            : "Custom segment — owner & manager can edit the rules."
        }
        action={
          segment.kind === "custom" ? (
            <SegmentDetailEditButton segment={segment} />
          ) : (
            <Badge tone="brand">
              <Sparkles className="h-3 w-3" strokeWidth={2.25} />
              Auto · immutable
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px),1fr]">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                Members
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-ink dark:text-cream-100">
                {memberCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                Last refreshed {relativeTime(segment.member_count_at)}
              </p>
            </div>

            <hr className="border-cream-200 dark:border-hairline-dark" />

            <dl className="space-y-2 text-sm">
              {ruleSummaryRows(segment).map((row) => (
                <div key={row.label} className="grid grid-cols-[110px,1fr] gap-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                    {row.label}
                  </dt>
                  <dd className="text-sm text-ink dark:text-cream-100">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-cream-200 px-5 py-3 dark:border-hairline-dark">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Members ({memberPage.members.length} shown)
            </h2>
          </div>
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
              {memberPage.members.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                  >
                    No customers match this segment yet.
                  </td>
                </tr>
              ) : (
                memberPage.members.map((m) => (
                  <tr
                    key={m.id}
                    className="bg-panel-light dark:bg-panel-dark"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/marketing/customers/${m.id}`}
                        className="text-sm font-semibold text-ink hover:text-brand-700 dark:text-cream-100"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {m.phone_e164 ?? "no phone"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {[...m.manual_tags.slice(0, 2), ...m.auto_tags.slice(0, 2)].map((t) => (
                          <StatusPill key={t} tone="neutral">
                            {t}
                          </StatusPill>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(m.total_spend_myr)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                      {relativeTime(m.last_purchase_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {memberPage.nextCursor ? (
            <div className="border-t border-cream-200 bg-cream-100/40 px-5 py-3 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400">
              {memberPage.members.length} members shown · more available via
              {" "}
              <code className="font-mono">
                GET /api/marketing/segments/{segment.id}/members?cursor={memberPage.nextCursor}
              </code>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
