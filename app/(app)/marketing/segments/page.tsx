import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Send, Target, Users } from "lucide-react";
import { SegmentList } from "@/components/marketing/SegmentList";
import { MarketingSubpageShell } from "@/components/marketing/MarketingSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { Card, CardBody } from "@/components/ui/card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/marketing/metrics";
import type { AutoSegmentKey } from "@/lib/marketing/segments-rules";
import { segmentsSubpageHero } from "@/lib/marketing/subpage-hero";

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
    .order("member_count", { ascending: false });

  const rows = (data ?? []) as SegmentRow[];
  const autoRows = rows.filter((r) => r.kind === "auto");
  const customRows = rows.filter((r) => r.kind === "custom");
  const totalMembers = rows.reduce((n, r) => n + r.member_count, 0);
  const segmentsWithMembers = rows.filter((r) => r.member_count > 0).length;
  const largestSegment =
    rows.length > 0
      ? rows.reduce((best, r) =>
          r.member_count > best.member_count ? r : best,
        )
      : null;
  const winBackMembers = rows
    .filter(
      (r) =>
        r.auto_key === "dormant" || r.auto_key === "at_risk",
    )
    .reduce((n, r) => n + r.member_count, 0);

  const hero = segmentsSubpageHero({
    total: rows.length,
    autoCount: autoRows.length,
    customCount: customRows.length,
    totalMembers,
    largestSegment: largestSegment
      ? { name: largestSegment.name, count: largestSegment.member_count }
      : null,
    winBackMembers,
  });

  return (
    <MarketingSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      cta={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {totalMembers > 0 ? (
            <Link
              href="/marketing/broadcasts/new"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition-colors hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:text-violet-200"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
              Send broadcast
            </Link>
          ) : null}
          <Link
            href="/marketing/segments/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New segment
          </Link>
        </div>
      }
      stats={
        rows.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <ModuleHeroStat
              label="Total members"
              value={formatCount(totalMembers)}
              hint="across all segments"
              icon={Users}
              iconClassName="text-violet-700 dark:text-violet-300"
            />
            <ModuleHeroStat
              label="Built-in"
              value={formatCount(autoRows.length)}
              hint="auto from tags"
              iconClassName="text-sky-700 dark:text-sky-300"
            />
            <ModuleHeroStat
              label="Custom"
              value={formatCount(customRows.length)}
              hint={
                customRows.length > 0 ? "your rules" : "none yet"
              }
              iconClassName="text-amber-700 dark:text-amber-300"
            />
            <ModuleHeroStat
              label="Ready to reach"
              value={formatCount(segmentsWithMembers)}
              hint="with members"
              icon={Target}
              iconClassName="text-emerald-700 dark:text-emerald-300"
              href="/marketing/broadcasts/new"
            />
          </div>
        ) : null
      }
    >
      {winBackMembers > 0 ? (
        <AiBanner
          label="Win-back pool"
          message={`${formatCount(winBackMembers)} customers in dormant or at-risk segments — pick one below and start a broadcast.`}
          cta="Send broadcast"
          href="/marketing/broadcasts/new"
        />
      ) : null}

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load segments: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <SegmentList autoRows={autoRows} customRows={customRows} />
    </MarketingSubpageShell>
  );
}
