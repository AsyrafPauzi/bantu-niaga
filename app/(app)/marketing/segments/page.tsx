import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Sparkles, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AUTO_KEY_LABEL,
  type AutoSegmentKey,
} from "@/lib/marketing/segments-rules";

export const metadata = { title: "Segments" };
export const dynamic = "force-dynamic";

interface SegmentRow {
  id: string;
  name: string;
  kind: "auto" | "custom";
  auto_key: AutoSegmentKey | null;
  member_count: number;
  member_count_at: string | null;
  created_at: string;
  updated_at: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export default async function MarketingSegmentsPage() {
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_segments")
    .select(
      "id, name, kind, auto_key, member_count, member_count_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("kind", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as SegmentRow[];
  const autoRows = rows.filter((r) => r.kind === "auto");
  const customRows = rows.filter((r) => r.kind === "custom");

  return (
    <div className="space-y-6">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to Marketing
      </Link>

      <PageHeader
        eyebrow="Marketing"
        title="Segments"
        description="Save cohorts you can broadcast to. Auto segments mirror the five system tags; custom segments let you mix tags, spend, and recency rules."
        action={
          <Link
            href="/marketing/segments/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            New segment
          </Link>
        }
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load segments: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
            <tr>
              <th className="px-5 py-3 text-left">Segment</th>
              <th className="px-3 py-3 text-left">Kind</th>
              <th className="px-3 py-3 text-right">Members</th>
              <th className="px-5 py-3 text-right">Last refreshed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  No segments yet — auto segments should appear after the
                  next migration apply.
                </td>
              </tr>
            ) : (
              [...autoRows, ...customRows].map((row) => (
                <tr
                  key={row.id}
                  className="bg-panel-light hover:bg-cream-100/60 dark:bg-panel-dark dark:hover:bg-hairline-dark/40"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/marketing/segments/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          row.kind === "auto"
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                            : "bg-accent-50 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200"
                        }`}
                      >
                        {row.kind === "auto" ? (
                          <Sparkles className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <Users className="h-4 w-4" strokeWidth={2} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink hover:text-brand-700 dark:text-cream-100">
                          {row.name}
                        </p>
                        {row.auto_key ? (
                          <p className="text-xs text-ink-muted dark:text-cream-400">
                            auto_key:{" "}
                            <code className="font-mono">{row.auto_key}</code> ·{" "}
                            {AUTO_KEY_LABEL[row.auto_key]}
                          </p>
                        ) : (
                          <p className="text-xs text-ink-muted dark:text-cream-400">
                            Custom rules · created {relativeTime(row.created_at)}
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    {row.kind === "auto" ? (
                      <Badge tone="brand">Auto</Badge>
                    ) : (
                      <Badge tone="accent">Custom</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                    {row.member_count.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                    {relativeTime(row.member_count_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
