import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
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
import { loadActiveSocialAccounts } from "@/lib/social/load";
import {
  hasMarketingAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { MARKETING_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";

export const metadata = { title: "New post" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function slugHandle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
  return cleaned || "business";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BN";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
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
  const [
    { data: contentRows },
    { data: business },
    socialAccounts,
    mayaEnabled,
    mayaSettings,
  ] = await Promise.all([
    supabase
      .from("content_plan")
      .select("status")
      .eq("business_id", user.businessId),
    supabase
      .from("businesses")
      .select("name, idcompany")
      .eq("id", user.businessId)
      .maybeSingle(),
    loadActiveSocialAccounts(user.businessId),
    hasMarketingAssistantAddon(user.businessId),
    loadBusinessAgentSettings(user.businessId, MARKETING_AGENT_SLUG),
  ]);

  const rewriteCreditCost = chatCreditsForReasoning(
    mayaSettings.reasoningMode,
  );

  const rows = contentRows ?? [];
  const scheduledCount = rows.filter((r) => r.status === "scheduled").length;
  const draftCount = rows.filter(
    (r) => r.status === "drafted" || r.status === "idea",
  ).length;
  const postedCount = rows.filter((r) => r.status === "posted").length;
  const hero = newContentSubpageHero({ prefillDateLabel });

  const businessName = business?.name?.trim() || "Business";
  const fallbackHandle = slugHandle(
    business?.idcompany?.trim() || businessName,
  );
  const ig = socialAccounts.find((a) => a.provider === "instagram");
  const fb = socialAccounts.find((a) => a.provider === "facebook");

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingContentBackLink />

      <ModuleDashboardHero
        module="Marketing · Content"
        pillar="marketing"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant="calm"
      >
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <ModuleHeroStat
            label="Scheduled"
            value={scheduledCount}
            icon={<Calendar />}
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
            iconClassName="text-purple-700 dark:text-purple-300"
          />
        </div>
      </ModuleDashboardHero>

      <NewContentFormPencil
        prefillDateIso={prefillIso}
        mayaEnabled={mayaEnabled}
        rewriteCreditCost={rewriteCreditCost}
        previewInitials={initialsFromName(businessName)}
        previewHandles={{
          instagram: ig?.username ?? null,
          facebook: fb?.username ?? (fb?.name ? slugHandle(fb.name) : null),
          fallback: fallbackHandle,
        }}
      />
    </div>
  );
}
