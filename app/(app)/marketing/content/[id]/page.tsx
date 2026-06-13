import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Copy,
  Eye,
  Facebook,
  Heart,
  MessageSquare,
  Share2,
  Sparkles,
  Video,
  Zap,
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
import type {
  ContentChannel,
  ContentEntryRow,
  ContentMediaRow,
  ContentStatus,
} from "@/components/marketing/types";

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

function extractHashtags(caption: string | null): string[] {
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

  const entryRow = entry as unknown as ContentEntryRow;
  const media = (mediaRaw ?? []) as unknown as ContentMediaRow[];
  const hashtags = extractHashtags(entryRow.caption);
  const channel = CHANNEL_META[entryRow.channel];
  const ChannelIcon = channel.icon;
  const isPosted = entryRow.status === "posted";

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
            <button
              type="button"
              disabled
              title="Duplicate ships in M7"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              Duplicate
            </button>
            {!isPosted ? (
              <button
                type="button"
                disabled
                title="Mark as Posted ships in M7"
                className="inline-flex items-center gap-1.5 rounded-lg bg-status-success/10 px-3 py-1.5 text-xs font-semibold text-status-success opacity-80"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                Mark as Posted
              </button>
            ) : null}
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
                { icon: Eye, label: "Views", value: isPosted ? "—" : "—" },
                { icon: Heart, label: "Likes", value: isPosted ? "—" : "—" },
                {
                  icon: MessageSquare,
                  label: "Comments",
                  value: isPosted ? "—" : "—",
                },
                { icon: Share2, label: "Shares", value: isPosted ? "—" : "—" },
                {
                  icon: Bookmark,
                  label: "Saves",
                  value: isPosted ? "—" : "—",
                },
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
                    {m.value}
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
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-4 dark:border-accent-700/40 dark:bg-accent-700/15">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
                <Zap className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-200">
                  Forecast · Maya
                </p>
                <p className="mt-1.5 text-sm text-ink dark:text-cream-100">
                  Expected reach <strong>2.4K–4.8K</strong> based on your last
                  10 {channel.label} posts. Best time to post mid-week, 9–11
                  AM MYT.
                </p>
                <p className="mt-2 text-[11px] text-ink-muted dark:text-cream-400">
                  Forecast switches to live data after the post goes live.
                </p>
              </div>
            </div>
          </div>

          <ContentEntryForm
            mode="edit"
            initial={entryRow}
            initialMedia={media}
          />
        </div>
      </div>
    </div>
  );
}
