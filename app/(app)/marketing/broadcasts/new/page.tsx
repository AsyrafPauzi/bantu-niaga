import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingBroadcastsBackLink } from "@/components/marketing/MarketingBroadcastsBackLink";
import { BroadcastComposer } from "@/components/marketing/BroadcastComposer";
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
import { newBroadcastSubpageHero } from "@/lib/marketing/subpage-hero";
import { Mail, MessageCircle, Send } from "lucide-react";

export const metadata = { title: "New broadcast" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewBroadcastPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "marketing", "broadcasts")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing broadcasts.
          </p>
        </CardBody>
      </Card>
    );
  }

  const sp = await searchParams;
  const segmentId =
    typeof sp.segment_id === "string" ? sp.segment_id.trim() : undefined;

  const supabase = await createSupabaseServerClient();
  const [{ data: business }, segmentResult, broadcastStats] = await Promise.all([
    supabase
      .from("businesses")
      .select("name")
      .eq("id", user.businessId)
      .maybeSingle(),
    segmentId
      ? supabase
          .from("customer_segments")
          .select("name")
          .eq("business_id", user.businessId)
          .eq("id", segmentId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("broadcasts")
      .select("status")
      .eq("business_id", user.businessId),
  ]);

  const businessName =
    typeof business?.name === "string" ? business.name : "Your business";
  const fromEmail = process.env.MARKETING_FROM_EMAIL ?? "hello@yourdomain.com";
  const segmentName =
    typeof segmentResult.data?.name === "string"
      ? segmentResult.data.name
      : null;
  const hero = newBroadcastSubpageHero({ segmentName });
  const rows = broadcastStats.data ?? [];
  const sentCount = rows.filter(
    (r) => r.status === "sent" || r.status === "partially_sent",
  ).length;
  const draftCount = rows.filter((r) => r.status === "draft").length;

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingBroadcastsBackLink />

      <ModuleDashboardHero
        module="Marketing · Broadcasts"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
      >
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <ModuleHeroStat
            label="Sent"
            value={sentCount}
            icon={<Send />}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Drafts"
            value={draftCount}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Channels"
            value="2"
            hint="WA + email"
            iconClassName="text-violet-700 dark:text-violet-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <BroadcastComposer
            initialSegmentId={segmentId}
            businessName={businessName}
            fromEmailLabel={fromEmail}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              How it works
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-ink dark:text-cream-100">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Pick a segment — only customers with a phone (WhatsApp) or
                  email are included.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Email sends via Resend with a branded HTML wrapper. Preview
                  before you send.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  WhatsApp opens click-to-chat links — you tap send in the app
                  for each person.
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
                <MessageCircle
                  className="h-4 w-4 text-[#25D366]"
                  strokeWidth={2}
                />
                WhatsApp click-to-chat
              </div>
              <div className="flex items-center gap-2 text-sm text-ink dark:text-cream-100">
                <Mail
                  className="h-4 w-4 text-violet-600 dark:text-violet-300"
                  strokeWidth={2}
                />
                Email via Resend
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
