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
import { StatusPill } from "@/components/dashboard/status-pill";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import { ContentEntryForm } from "@/components/marketing/ContentEntryForm";
import { ContentActions } from "@/components/marketing/ContentActions";
import { ContentSharePanel } from "@/components/marketing/ContentSharePanel";
import { MarketingAddonTeaser } from "@/components/marketing/MarketingAddonTeaser";
import { PublishPanel } from "@/components/marketing/social/PublishPanel";
import { InsightsPanel } from "@/components/marketing/social/InsightsPanel";
import { META_SOCIAL_ADDON_SLUG } from "@/lib/marketing/addon-slugs";
import { contentDetailSubpageHero } from "@/lib/marketing/subpage-hero";
import type {
  ContentChannel,
  ContentEntryRow,
  ContentMediaRow,
  ContentStatus,
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

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-MY");
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
  const ChannelIcon = channel.icon;
  const isPosted = entry.status === "posted";
  const forecastMin = entry.forecast_reach_min ?? null;
  const forecastMax = entry.forecast_reach_max ?? null;
  const forecastLabel =
    forecastMin !== null && forecastMax !== null
      ? `${fmtNumber(forecastMin)}–${fmtNumber(forecastMax)}`
      : "2.4K–4.8K (estimate)";

  const hero = contentDetailSubpageHero({
    hook: entry.hook,
    channel: entry.channel,
    status: entry.status,
    scheduledAt: entry.scheduled_at,
  });

  return (
    <div className="space-y-6 pb-8">
      <ModuleDashboardHero
        module="Marketing · Content"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
        headerExtra={
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[entry.status]}>
              {entry.status}
            </StatusPill>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-2.5 py-1 text-[11px] font-semibold dark:bg-hairline-dark ${channel.color}`}
            >
              <ChannelIcon className="h-3 w-3" strokeWidth={2} />
              {channel.label}
            </span>
          </div>
        }
        cta={<ContentActions contentId={entry.id} isPosted={isPosted} />}
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Views"
            value={isPosted ? fmtNumber(entry.views) : "—"}
            icon={Eye}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Likes"
            value={isPosted ? fmtNumber(entry.likes) : "—"}
            icon={Heart}
            iconClassName="text-rose-700 dark:text-rose-300"
          />
          <ModuleHeroStat
            label="Comments"
            value={isPosted ? fmtNumber(entry.comments_count) : "—"}
            icon={MessageSquare}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Shares"
            value={isPosted ? fmtNumber(entry.shares) : "—"}
            icon={Share2}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-cream-200 bg-panel-light px-5 py-4 text-sm shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Scheduled
          </p>
          <p className="font-medium text-ink dark:text-cream-100">
            {fmtFullDate(entry.scheduled_at)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Posted
          </p>
          <p className="font-medium text-ink dark:text-cream-100">
            {fmtFullDate(entry.posted_at)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
            Created
          </p>
          <p className="font-medium text-ink dark:text-cream-100">
            {fmtFullDate(entry.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <SectionCard title="Caption" subtitle="Body text + hashtags">
            <div className="space-y-3">
              {entry.caption ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-cream-100/60 p-3.5 font-sans text-sm leading-relaxed text-ink dark:bg-hairline-dark/30 dark:text-cream-100">
                  {entry.caption}
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
                    className="flex h-28 items-center justify-center rounded-lg border border-dashed border-cream-300 bg-cream-100/60 p-3 text-center font-mono text-[10px] text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-400"
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
                { icon: Eye, label: "Views", value: entry.views },
                { icon: Heart, label: "Likes", value: entry.likes },
                {
                  icon: MessageSquare,
                  label: "Comments",
                  value: entry.comments_count,
                },
                { icon: Share2, label: "Shares", value: entry.shares },
                { icon: Bookmark, label: "Saves", value: entry.saves },
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
                    {isPosted
                      ? fmtNumber(m.value)
                      : m.value > 0
                        ? fmtNumber(m.value)
                        : "—"}
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
              contentPlanId={entry.id}
              contentChannel={entry.channel}
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
            title="Maya · Marketing AI"
            description={`Ask Maya to rewrite captions, draft broadcasts, or estimate reach (e.g. ${forecastLabel}). Use the Ask Maya button on any Marketing page after activating.`}
            slug="marketing-assistant"
            comingSoon={false}
            ctaLabel="Open Maya / Marketplace →"
          />

          <ContentEntryForm
            mode="edit"
            initial={entry}
            initialMedia={media}
          />
        </div>
      </div>

      {metaPublishEnabled ? <InsightsPanel publishes={publishes} /> : null}
    </div>
  );
}
