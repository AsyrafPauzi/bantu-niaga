import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Eye,
  Facebook,
  Heart,
  MessageSquare,
  Share2,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentEntryForm } from "@/components/marketing/ContentEntryForm";
import { ContentActions } from "@/components/marketing/ContentActions";
import { ContentSharePanel } from "@/components/marketing/ContentSharePanel";
import { MarketingAddonTeaser } from "@/components/marketing/MarketingAddonTeaser";
import { PublishPanel } from "@/components/marketing/social/PublishPanel";
import { InsightsPanel } from "@/components/marketing/social/InsightsPanel";
import { loadAddonFeatureState } from "@/lib/marketplace/addon-availability";
import { META_SOCIAL_ADDON_SLUG } from "@/lib/marketing/addon-slugs";
import {
  loadActiveSocialAccounts,
  loadPublishesForContent,
} from "@/lib/social/load";
import type {
  ContentChannel,
  ContentEntryRow,
  ContentMediaRow,
  ContentStatus,
} from "@/components/marketing/types";

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

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Content ${id.slice(0, 8)}` };
}

const CHANNEL_META: Record<
  ContentChannel,
  { label: string; icon: LucideIcon; tone: "brand" | "accent" | "warning"; color: string }
> = {
  tiktok: {
    label: "TikTok",
    icon: Video,
    tone: "accent",
    color: "text-accent-700 dark:text-accent-200",
  },
  instagram: {
    label: "Instagram",
    icon: Camera,
    tone: "brand",
    color: "text-brand-700 dark:text-brand-200",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    tone: "brand",
    color: "text-brand-700 dark:text-brand-200",
  },
};

const STATUS_TONE: Record<ContentStatus, "neutral" | "warning" | "success" | "brand"> = {
  idea: "neutral",
  drafted: "warning",
  scheduled: "success",
  posted: "brand",
};

function fmtFullDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleString("en-MY", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function extractHashtagsFromCaption(caption: string | null): string[] {
  if (!caption) return [];
  const tags = caption.match(/#[\w-]+/g);
  return tags ? Array.from(new Set(tags)) : [];
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-MY");
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
  // Prefer the explicit hashtags column; fall back to caption-extracted
  // tags for legacy rows that pre-date the migration.
  const hashtags =
    entryRow.hashtags && entryRow.hashtags.length > 0
      ? entryRow.hashtags
      : extractHashtagsFromCaption(entryRow.caption);
  const channel = CHANNEL_META[entryRow.channel];
  const ChannelIcon = channel.icon;
  const isPosted = entryRow.status === "posted";
  const forecastMin = entryRow.forecast_reach_min ?? null;
  const forecastMax = entryRow.forecast_reach_max ?? null;
  const forecastLabel =
    forecastMin !== null && forecastMax !== null
      ? `${fmtNumber(forecastMin)}–${fmtNumber(forecastMax)}`
      : "2.4K–4.8K (estimate)";

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/content"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to calendar
      </Link>

      <PageHeader
        eyebrow="Marketing · Content"
        title={entryRow.hook ?? "Untitled post"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[entryRow.status]}>
              {entryRow.status.toUpperCase()}
            </StatusPill>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold dark:bg-hairline-dark ${channel.color}`}
            >
              <ChannelIcon className="h-3.5 w-3.5" strokeWidth={2} />
              {channel.label}
            </span>
            <ContentActions contentId={entryRow.id} isPosted={isPosted} />
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Scheduled
            </p>
            <p className="font-medium text-ink dark:text-cream-100">
              {fmtFullDate(entryRow.scheduled_at)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Posted
            </p>
            <p className="font-medium text-ink dark:text-cream-100">
              {fmtFullDate(entryRow.posted_at)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
              Created
            </p>
            <p className="font-medium text-ink dark:text-cream-100">
              {fmtFullDate(entryRow.created_at)}
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <SectionCard title="Caption" subtitle="Body text + hashtags">
            <div className="space-y-3">
              {entryRow.caption ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-cream-100/60 p-3.5 font-sans text-sm leading-relaxed text-ink dark:bg-hairline-dark/30 dark:text-cream-100">
                  {entryRow.caption}
                </pre>
              ) : (
                <p className="rounded-lg bg-cream-100/60 p-3.5 text-sm italic text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                  No caption yet.
                </p>
              )}
              {hashtags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Media"
            subtitle={`${media.length} attachment${media.length === 1 ? "" : "s"}`}
          >
            {media.length === 0 ? (
              <p className="rounded-lg bg-cream-100/60 p-4 text-sm italic text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                No media attached. Media uploads activate when Admin Storage
                ships (D6).
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {media.map((m) => (
                  <li
                    key={m.file_id}
                    className="flex h-28 items-center justify-center rounded-lg border border-dashed border-cream-300 bg-cream-100/60 p-3 text-center text-[10px] font-mono text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400"
                  >
                    {m.file_id.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Performance"
            subtitle={
              isPosted
                ? "Engagement metrics"
                : "Available once the post is live"
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { icon: Eye, label: "Views", value: entryRow.views },
                { icon: Heart, label: "Likes", value: entryRow.likes },
                {
                  icon: MessageSquare,
                  label: "Comments",
                  value: entryRow.comments_count,
                },
                { icon: Share2, label: "Shares", value: entryRow.shares },
                { icon: Bookmark, label: "Saves", value: entryRow.saves },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-cream-200 bg-panel-light p-3 dark:border-hairline-dark dark:bg-panel-dark"
                >
                  <m.icon
                    className="mb-1 h-4 w-4 text-ink-muted"
                    strokeWidth={2}
                  />
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {m.label}
                  </p>
                  <p className="text-lg font-bold text-ink dark:text-cream-100">
                    {isPosted ? fmtNumber(m.value) : m.value > 0 ? fmtNumber(m.value) : "—"}
                  </p>
                </div>
              ))}
            </div>
            {!isPosted ? (
              <p className="mt-3 text-xs italic text-ink-muted dark:text-cream-400">
                Views, likes, comments, shares and saves sync from{" "}
                {channel.label} once the post is live and the platform webhook
                is connected.
              </p>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <ContentSharePanel
            caption={defaultCaption}
            channelLabel={channel.label}
          />

          {metaPublishEnabled ? (
            <PublishPanel
              contentPlanId={entryRow.id}
              contentChannel={entryRow.channel}
              defaultCaption={defaultCaption}
              accounts={socialAccounts}
              alreadyPosted={isPosted}
            />
          ) : (
            <MarketingAddonTeaser
              title="Auto-publish to Facebook & Instagram"
              description="Connect Meta pages and publish from this calendar in one click. Core Marketing lets you plan and share drafts manually."
              slug={META_SOCIAL_ADDON_SLUG}
            />
          )}

          <MarketingAddonTeaser
            title="Maya · reach forecast"
            description={`AI reach estimates (e.g. ${forecastLabel}) unlock with the Marketing AI add-on.`}
            slug="marketing-assistant"
          />

          <ContentEntryForm
            mode="edit"
            initial={entryRow}
            initialMedia={media}
          />
        </div>
      </div>

      {metaPublishEnabled ? <InsightsPanel publishes={publishes} /> : null}
    </div>
  );
}
