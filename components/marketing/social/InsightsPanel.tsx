import {
  BarChart3,
  Camera,
  ExternalLink,
  Eye,
  Facebook,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  PlayCircle,
} from "lucide-react";
import type { PublishWithMetrics } from "@/lib/social/types";
import { InsightsRefreshButton } from "./InsightsRefreshButton";

interface InsightsPanelProps {
  publishes: PublishWithMetrics[];
}

/**
 * Per-platform analytics panel rendered below the Content Detail layout.
 *
 * Each social_post_publish row gets its own metric strip with a Refresh
 * button that hits /api/social/meta/insights/[publishId]. The latest
 * metrics row is used; if it's null we show "Refresh to load".
 */
export function InsightsPanel({ publishes }: InsightsPanelProps) {
  if (publishes.length === 0) return null;

  return (
    <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <BarChart3 className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
            Insights from Meta
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            Live impressions, reach and engagement pulled from the Graph API.
            Press <strong>Refresh</strong> to pull fresh numbers.
          </p>
        </div>
      </div>

      <ul className="space-y-4">
        {publishes.map((p) => (
          <PublishRow key={p.id} publish={p} />
        ))}
      </ul>
    </div>
  );
}

function PublishRow({ publish }: { publish: PublishWithMetrics }) {
  const Icon = publish.account.provider === "facebook" ? Facebook : Camera;
  const failed = publish.status === "failed";
  const queued = publish.status === "queued";
  const m = publish.metrics;

  return (
    <li className="rounded-lg border border-cream-200 p-4 dark:border-hairline-dark">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <Icon
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              publish.account.provider === "facebook"
                ? "text-[#1877F2]"
                : "text-accent-600"
            }`}
            strokeWidth={2}
          />
          <div>
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              {publish.account.name}
              {publish.account.username ? (
                <span className="ml-1 text-xs font-normal text-ink-muted dark:text-cream-400">
                  @{publish.account.username}
                </span>
              ) : null}
            </p>
            <p className="text-[11px] text-ink-muted dark:text-cream-400">
              {failed
                ? "Publish failed"
                : queued
                  ? "Queued"
                  : publish.posted_at
                    ? `Posted ${formatDate(publish.posted_at)}`
                    : "Posted"}
              {publish.permalink ? (
                <>
                  {" · "}
                  <a
                    href={publish.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold text-brand-700 underline dark:text-brand-200"
                  >
                    View post
                    <ExternalLink className="h-3 w-3" strokeWidth={2} />
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
        {publish.status === "posted" ? (
          <InsightsRefreshButton publishId={publish.id} />
        ) : null}
      </div>

      {failed && publish.error_message ? (
        <p className="rounded-md bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
          {publish.error_message}
        </p>
      ) : !m ? (
        <p className="rounded-md bg-cream-100/50 px-3 py-2 text-xs italic text-ink-muted dark:bg-hairline-dark/40 dark:text-cream-400">
          {publish.status === "posted"
            ? "No metrics fetched yet. Click Refresh to pull from Meta."
            : "Metrics will be available once the publish completes."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric icon={Eye} label="Impressions" value={m.impressions} />
            <Metric icon={Eye} label="Reach" value={m.reach} />
            <Metric icon={Heart} label="Likes" value={m.likes} />
            <Metric
              icon={MessageSquare}
              label="Comments"
              value={m.comments}
            />
            <Metric icon={Share2} label="Shares" value={m.shares} />
            <Metric icon={Bookmark} label="Saves" value={m.saves} />
            <Metric
              icon={PlayCircle}
              label="Video views"
              value={m.video_views}
            />
            <Metric icon={BarChart3} label="Engaged" value={m.engaged_users} />
          </div>
          <p className="mt-2 text-[10px] text-ink-muted dark:text-cream-400">
            Last refreshed {formatDate(m.fetched_at)}
          </p>
        </>
      )}
    </li>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md bg-cream-100/60 p-2 dark:bg-hairline-dark/30">
      <Icon
        className="mb-1 h-3.5 w-3.5 text-ink-muted"
        strokeWidth={2}
      />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
        {label}
      </p>
      <p className="text-base font-bold text-ink dark:text-cream-100">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-MY");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-MY", {
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kuala_Lumpur",
    });
  } catch {
    return iso;
  }
}
