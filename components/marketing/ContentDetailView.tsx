import {
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
import { ContentEntryForm } from "@/components/marketing/ContentEntryForm";
import { ContentActions } from "@/components/marketing/ContentActions";
import { ContentSharePanel } from "@/components/marketing/ContentSharePanel";
import { MarketingAddonTeaser } from "@/components/marketing/MarketingAddonTeaser";
import { PublishPanel } from "@/components/marketing/social/PublishPanel";
import { InsightsPanel } from "@/components/marketing/social/InsightsPanel";
import { META_SOCIAL_ADDON_SLUG } from "@/lib/marketing/addon-slugs";
import {
  CHANNEL_META,
  formatDayHeading,
  formatPostTime,
  isoDayMyt,
  STATUS_META,
} from "@/lib/marketing/content-calendar-shared";
import { cn } from "@/lib/utils/cn";
import type {
  ContentChannel,
  ContentEntryRow,
  ContentMediaRow,
} from "@/components/marketing/types";
import type { PublishWithMetrics, SocialAccount } from "@/lib/social/types";

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

const CHANNEL_ICON: Record<ContentChannel, LucideIcon> = {
  tiktok: Video,
  instagram: Camera,
  facebook: Facebook,
};

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-MY");
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return null;
  const dateKey = isoDayMyt(d);
  return `${formatDayHeading(dateKey)} · ${formatPostTime(iso)} MYT`;
}

interface ContentDetailViewProps {
  entry: ContentEntryRowWithMetrics;
  media: ContentMediaRow[];
  hashtags: string[];
  defaultCaption: string;
  socialAccounts: SocialAccount[];
  publishes: PublishWithMetrics[];
  metaPublishEnabled: boolean;
}

function EngagementStrip({
  views,
  likes,
  comments,
  shares,
  saves,
}: {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}) {
  const items = [
    { icon: Eye, label: "Views", value: views },
    { icon: Heart, label: "Likes", value: likes },
    { icon: MessageSquare, label: "Comments", value: comments },
    { icon: Share2, label: "Shares", value: shares },
    { icon: Bookmark, label: "Saves", value: saves },
  ];
  const hasAny = items.some((i) => i.value > 0);

  if (!hasAny) {
    return (
      <p className="text-xs text-white/75">
        No engagement numbers recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items
        .filter((i) => i.value > 0)
        .map((i) => (
          <span
            key={i.label}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white"
          >
            <i.icon className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            <span className="tabular-nums">{fmtNumber(i.value)}</span>
            <span className="text-white/80">{i.label}</span>
          </span>
        ))}
    </div>
  );
}

export function ContentDetailView({
  entry,
  media,
  hashtags,
  defaultCaption,
  socialAccounts,
  publishes,
  metaPublishEnabled,
}: ContentDetailViewProps) {
  const channel = CHANNEL_META[entry.channel];
  const status = STATUS_META[entry.status];
  const ChannelIcon = CHANNEL_ICON[entry.channel];
  const isPosted = entry.status === "posted";
  const title = entry.hook?.trim() || "Untitled post";
  const scheduledLine = formatWhen(entry.scheduled_at);
  const postedLine = formatWhen(entry.posted_at);

  return (
    <div className="space-y-4">
      <header
        className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-800 p-5 text-white shadow-lg dark:border-violet-900/50"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_80%_100%,rgba(0,0,0,0.15),transparent_50%)]"
          aria-hidden
        />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                Marketing · Content
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                    status.pill,
                  )}
                >
                  {status.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                    channel.chip,
                  )}
                >
                  <ChannelIcon className="h-3 w-3" strokeWidth={2.25} />
                  {channel.label}
                </span>
              </div>
            </div>
            <ContentActions contentId={entry.id} isPosted={isPosted} variant="hero" />
          </div>

          <div className="space-y-1 text-sm text-white/90">
            {scheduledLine ? (
              <p>
                <span className="font-semibold text-white">Scheduled</span>
                {" · "}
                {scheduledLine}
              </p>
            ) : (
              <p className="text-white/75">No scheduled date — set one below.</p>
            )}
            {postedLine ? (
              <p>
                <span className="font-semibold text-white">Posted</span>
                {" · "}
                {postedLine}
              </p>
            ) : null}
          </div>

          {isPosted ? (
            <EngagementStrip
              views={entry.views}
              likes={entry.likes}
              comments={entry.comments_count}
              shares={entry.shares}
              saves={entry.saves}
            />
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <h2 className="text-sm font-bold text-ink dark:text-cream-100">
              Caption
            </h2>
            {entry.caption ? (
              <pre
                className="mt-3 whitespace-pre-wrap rounded-xl bg-violet-50/60 p-4 font-sans text-sm leading-relaxed text-ink dark:bg-violet-950/20 dark:text-cream-100"
              >
                {entry.caption}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-ink-muted dark:text-cream-400">
                No caption yet — add one in Edit below.
              </p>
            )}
            {hashtags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hashtags.map((h) => (
                  <span
                    key={h}
                    className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                  >
                    {h}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <ContentEntryForm
            mode="edit"
            initial={entry}
            initialMedia={media}
          />
        </div>

        <aside className="space-y-4">
          <ContentSharePanel
            caption={defaultCaption}
            channelLabel={channel.label}
          />

          {metaPublishEnabled ? (
            <PublishPanel
              contentPlanId={entry.id}
              contentChannel={entry.channel}
              defaultCaption={defaultCaption}
              accounts={socialAccounts}
              alreadyPosted={isPosted}
              attachedMediaIds={media.map((m) => m.file_id)}
            />
          ) : (
            <MarketingAddonTeaser
              title="Auto-publish to Facebook & Instagram"
              description="Connect Meta pages and publish from this calendar in one click."
              slug={META_SOCIAL_ADDON_SLUG}
            />
          )}
        </aside>
      </div>

      {metaPublishEnabled && publishes.length > 0 ? (
        <InsightsPanel publishes={publishes} />
      ) : null}
    </div>
  );
}
