import { redirect } from "next/navigation";
import { Sparkles, Target, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingSegmentsBackLink } from "@/components/marketing/MarketingSegmentsBackLink";
import { NewSegmentForm } from "./new-segment-form";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/marketing/metrics";
import { newSegmentSubpageHero } from "@/lib/marketing/subpage-hero";

export const metadata = { title: "New segment" };
export const dynamic = "force-dynamic";

export default async function NewSegmentPage() {
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
  const { data: segmentRows } = await supabase
    .from("customer_segments")
    .select("kind, member_count")
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  const rows = segmentRows ?? [];
  const customCount = rows.filter((r) => r.kind === "custom").length;
  const autoCount = rows.filter((r) => r.kind === "auto").length;
  const totalMembers = rows.reduce((n, r) => n + (r.member_count ?? 0), 0);
  const hero = newSegmentSubpageHero({ customCount, totalMembers });

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingSegmentsBackLink />

      <ModuleDashboardHero
        module="Marketing · Segments"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
      >
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <ModuleHeroStat
            label="Built-in"
            value={autoCount}
            icon={Sparkles}
            hint="auto groups"
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Custom"
            value={customCount}
            icon={Target}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Members"
            value={formatCount(totalMembers)}
            icon={Users}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-cream-200 bg-panel-light shadow-card dark:border-hairline-dark dark:bg-panel-dark lg:col-span-2">
          <div className="border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Rule builder
            </h2>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Stack as many or as few rules as you like. The matches counter
              updates as you type.
            </p>
          </div>
          <div className="p-5">
            <NewSegmentForm />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Built-in vs custom
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-ink dark:text-cream-100">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  VIP, repeat, new, at-risk, and dormant are automatic — you
                  can&apos;t edit those rules.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Custom segments narrow by spend, tags, last purchase, and
                  more — great for one-off campaigns.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  After saving, send a broadcast straight from the segment
                  detail page.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-cream-200 bg-panel-light p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Example rules
            </p>
            <div className="mt-3 space-y-2 text-sm text-ink dark:text-cream-100">
              <p>Spend ≥ RM 500 and tag contains wholesale</p>
              <p>Last purchase within 30 days</p>
              <p>Manual tag is regular AND not in dormant</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
