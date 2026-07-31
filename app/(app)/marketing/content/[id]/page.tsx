import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingContentBackLink } from "@/components/marketing/MarketingContentBackLink";
import { ContentDetailView } from "@/components/marketing/ContentDetailView";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAddonFeatureState } from "@/lib/marketplace/addon-availability";
import { META_SOCIAL_ADDON_SLUG } from "@/lib/marketing/addon-slugs";
import {
  loadActiveSocialAccounts,
  loadPublishesForContent,
} from "@/lib/social/load";
import type {
  ContentEntryRow,
  ContentMediaRow,
} from "@/components/marketing/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ContentEntryRowWithMetrics extends ContentEntryRow {
  hashtags: string[];
  views: number;
  likes: number;
  comments_count: number;
  shares: number;
  saves: number;
  forecast_reach_min: number | null;
  forecast_reach_max: number | null;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { title: "Content" };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("content_plan")
    .select("hook")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();
  return { title: data?.hook ?? "Content" };
}

function extractHashtagsFromCaption(caption: string | null): string[] {
  if (!caption) return [];
  const tags = caption.match(/#[\w-]+/g);
  return tags ? Array.from(new Set(tags)) : [];
}

export default async function ContentDetailPage({ params }: PageProps) {
  const { id } = await params;

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

  const supabase = await createSupabaseServerClient();

  const { data: entry, error } = await supabase
    .from("content_plan")
    .select(
      "id, business_id, channel, status, scheduled_at, hook, caption, " +
        "hashtags, views, likes, comments_count, shares, saves, " +
        "forecast_reach_min, forecast_reach_max, " +
        "created_by, posted_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-status-danger">
            Failed to load content: {error.message}
          </p>
        </CardBody>
      </Card>
    );
  }
  if (!entry) notFound();

  const { data: mediaRaw } = await supabase
    .from("content_plan_media")
    .select("file_id, position")
    .eq("content_plan_id", id)
    .order("position", { ascending: true });

  const entryRow = entry as unknown as ContentEntryRowWithMetrics;
  const media = (mediaRaw ?? []) as unknown as ContentMediaRow[];

  const [socialAccounts, publishes, metaAddon] = await Promise.all([
    loadActiveSocialAccounts(user.businessId),
    loadPublishesForContent(user.businessId, id),
    loadAddonFeatureState(user.businessId, META_SOCIAL_ADDON_SLUG),
  ]);
  const metaPublishEnabled = metaAddon.accessible;

  const defaultCaption = [entryRow.hook, entryRow.caption]
    .filter(Boolean)
    .join("\n\n");
  const hashtags =
    entryRow.hashtags && entryRow.hashtags.length > 0
      ? entryRow.hashtags
      : extractHashtagsFromCaption(entryRow.caption);

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingContentBackLink />
      <ContentDetailView
        entry={entryRow}
        media={media}
        hashtags={hashtags}
        defaultCaption={defaultCaption}
        socialAccounts={socialAccounts}
        publishes={publishes}
        metaPublishEnabled={metaPublishEnabled}
      />
    </div>
  );
}
