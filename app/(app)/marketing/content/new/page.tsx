import { redirect } from "next/navigation";
import { Calendar, Camera, Video } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingContentBackLink } from "@/components/marketing/MarketingContentBackLink";
import { NewContentFormPencil } from "@/components/marketing/NewContentFormPencil";
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
import { newContentSubpageHero } from "@/lib/marketing/subpage-hero";

export const metadata = { title: "New post" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewContentPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "content")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to the Content calendar.
          </p>
        </CardBody>
      </Card>
    );
  }

  const raw = await searchParams;
  const dateParam = typeof raw.date === "string" ? raw.date : undefined;
  let prefillIso: string | undefined;
  let prefillDateLabel: string | null = null;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    prefillIso = new Date(`${dateParam}T09:00:00+08:00`).toISOString();
    prefillDateLabel = new Date(`${dateParam}T12:00:00+08:00`).toLocaleDateString(
      "en-MY",
      { weekday: "short", month: "short", day: "numeric", year: "numeric" },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: contentRows } = await supabase
    .from("content_plan")
    .select("status")
    .eq("business_id", user.businessId);

  const rows = contentRows ?? [];
  const scheduledCount = rows.filter((r) => r.status === "scheduled").length;
  const draftCount = rows.filter(
    (r) => r.status === "drafted" || r.status === "idea",
  ).length;
  const postedCount = rows.filter((r) => r.status === "posted").length;
  const hero = newContentSubpageHero({ prefillDateLabel });

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingContentBackLink />

      <ModuleDashboardHero
        module="Marketing · Content"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
      >
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <ModuleHeroStat
            label="Scheduled"
            value={scheduledCount}
            icon={Calendar}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Drafts"
            value={draftCount}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Posted"
            value={postedCount}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <NewContentFormPencil prefillDateIso={prefillIso} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Planning tips
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-ink dark:text-cream-100">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Start with a hook — the first line is what shows in the
                  calendar and list views.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Schedule ahead so you can batch-create captions on quiet
                  days, then post manually when ready.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Mark as posted after you publish — engagement metrics sync
                  when platform webhooks are connected.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-cream-200 bg-panel-light p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Channels
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-ink dark:text-cream-100">
                <Video className="h-4 w-4 text-accent-700" strokeWidth={2} />
                TikTok
              </div>
              <div className="flex items-center gap-2 text-sm text-ink dark:text-cream-100">
                <Camera className="h-4 w-4 text-brand-700" strokeWidth={2} />
                Instagram
              </div>
              <div className="flex items-center gap-2 text-sm text-ink dark:text-cream-100">
                <Calendar className="h-4 w-4 text-amber-700" strokeWidth={2} />
                Facebook
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
