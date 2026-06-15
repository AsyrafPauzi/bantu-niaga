"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  Bookmark,
  Camera,
  Facebook,
  Heart,
  Image as ImageIcon,
  Info,
  MessageCircle,
  MoreHorizontal,
  Send,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  ContentMediaUploader,
  type ContentMediaUploaderHandle,
} from "@/components/marketing/ContentMediaUploader";

/**
 * Pencil-aligned New Content form. Channel tile picker, Hook + Caption
 * + Hashtags + Media slots on the left, Schedule + Preview on the right.
 * Calls the same POST /api/marketing/content API as the legacy
 * ContentEntryForm (mode="create").
 */

type Channel = "tiktok" | "instagram" | "facebook";
type Status = "idea" | "drafted" | "scheduled" | "posted";

interface FormState {
  channel: Channel;
  status: Status;
  scheduledDate: string; // YYYY-MM-DD MYT
  scheduledTime: string; // HH:mm MYT
  hook: string;
  caption: string;
}

interface NewContentFormPencilProps {
  prefillDateIso?: string;
}

const MYT_OFFSET = "+08:00";

function utcIsoToMytParts(iso: string | undefined): {
  date: string;
  time: string;
} {
  if (!iso) return { date: "", time: "" };
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { date: "", time: "" };
  const myt = new Date(t + 8 * 3_600_000);
  const y = myt.getUTCFullYear();
  const m = String(myt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(myt.getUTCDate()).padStart(2, "0");
  const hh = String(myt.getUTCHours()).padStart(2, "0");
  const mm = String(myt.getUTCMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

function mytPartsToUtcIso(date: string, time: string): string | null {
  if (!date) return null;
  const safeTime = time && /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  const local = `${date}T${safeTime}:00${MYT_OFFSET}`;
  const t = Date.parse(local);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

const CHANNEL_META: Record<
  Channel,
  { label: string; icon: LucideIcon; tone: string }
> = {
  tiktok: {
    label: "TikTok",
    icon: Video,
    tone: "border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-500 dark:bg-accent-700/20 dark:text-accent-200",
  },
  instagram: {
    label: "Instagram",
    icon: Camera,
    tone: "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/40 dark:text-brand-200",
  },
  facebook: {
    label: "Facebook",
    icon: Facebook,
    tone: "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/40 dark:text-brand-200",
  },
};

const STATUS_TONE: Record<Status, { dot: string; text: string; bg: string }> = {
  idea: {
    dot: "bg-ink-subtle",
    text: "text-ink-muted dark:text-cream-400",
    bg: "bg-cream-200 dark:bg-hairline-dark",
  },
  drafted: {
    dot: "bg-[#C9A24A]",
    text: "text-[#8C5C0A] dark:text-[#F5C97A]",
    bg: "bg-[#FDF2DC] dark:bg-[#3A2A0A]",
  },
  scheduled: {
    dot: "bg-status-success",
    text: "text-status-success",
    bg: "bg-status-success/10",
  },
  posted: {
    dot: "bg-brand-500",
    text: "text-brand-700 dark:text-brand-200",
    bg: "bg-brand-50 dark:bg-brand-900/40",
  },
};

const HASHTAG_SUGGESTIONS = [
  "#nasilemak",
  "#shahalam",
  "#ramadhanmubarak",
  "#hariraya",
  "#kedaisaya",
  "#malaysianfood",
  "#sambal",
  "#viral",
];

export function NewContentFormPencil({
  prefillDateIso,
}: NewContentFormPencilProps) {
  const router = useRouter();
  const prefill = utcIsoToMytParts(prefillDateIso);

  const [form, setForm] = useState<FormState>({
    channel: "instagram",
    status: "drafted",
    scheduledDate: prefill.date,
    scheduledTime: prefill.time || "09:00",
    hook: "",
    caption: "",
  });
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaState, setMediaState] = useState<{
    uploadingCount: number;
    uploadedCount: number;
    firstImagePreviewUrl: string | null;
  }>({ uploadingCount: 0, uploadedCount: 0, firstImagePreviewUrl: null });
  const [warning, setWarning] = useState<string | null>(null);
  const mediaRef = useRef<ContentMediaUploaderHandle | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function toggleHashtag(tag: string) {
    setHashtags((s) => (s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]));
  }

  const handleMediaChange = useCallback(
    (state: {
      uploadingCount: number;
      uploadedCount: number;
      firstImagePreviewUrl: string | null;
    }) => {
      setMediaState(state);
    },
    [],
  );

  async function submit(status: Status): Promise<void> {
    if (busy) return;
    if (mediaRef.current?.isUploading()) {
      setError("Wait for media uploads to finish before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    setWarning(null);
    const scheduled = mytPartsToUtcIso(form.scheduledDate, form.scheduledTime);
    try {
      const res = await fetch("/api/marketing/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: form.channel,
          status,
          scheduled_at: scheduled,
          hook: form.hook || null,
          caption: form.caption.trim() || null,
          hashtags,
          media_file_ids: [],
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        action?: string;
        entry?: { id?: string };
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      const id = body?.entry?.id;

      const fileIds = mediaRef.current?.getUploadedFileIds() ?? [];
      if (id && fileIds.length > 0) {
        try {
          const attachRes = await fetch(
            "/api/marketing/media/attach-to-content",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content_plan_id: id,
                file_ids: fileIds,
                position_start: 0,
              }),
            },
          );
          if (!attachRes.ok) {
            const attachBody = (await attachRes
              .json()
              .catch(() => null)) as { error?: { message?: string } } | null;
            // The post itself was saved — surface a soft warning so the
            // operator knows the link step failed but the row exists.
            setWarning(
              attachBody?.error?.message ??
                "Post saved, but linking media failed. You can re-attach from the post page.",
            );
          }
        } catch (e) {
          setWarning(
            e instanceof Error
              ? `Post saved, but linking media failed: ${e.message}`
              : "Post saved, but linking media failed.",
          );
        }
      }

      if (id) {
        router.push(`/marketing/content/${id}`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.scheduledDate) {
      setError("Pick a date before scheduling.");
      return;
    }
    await submit("scheduled");
  }

  const channelMeta = CHANNEL_META[form.channel];

  const previewCaptionLines = (() => {
    const cap = form.caption.trim();
    return cap ? cap.split("\n").slice(0, 4) : [];
  })();

  const statusTone = STATUS_TONE[form.status];

  return (
    <form onSubmit={handleSchedule} className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-cream-100">
            Plan a new post
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Draft once — publish to TikTok, Instagram, or Facebook with one
            click later.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${statusTone.bg} ${statusTone.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
          Status: {form.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* LEFT — Channel + Content + Media */}
        <div className="space-y-4">
          {/* CHANNEL */}
          <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
              Channel
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {(["tiktok", "instagram", "facebook"] as const).map((c) => {
                const meta = CHANNEL_META[c];
                const Icon = meta.icon;
                const active = form.channel === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update("channel", c)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3.5 transition-all ${
                      active
                        ? meta.tone
                        : "border-cream-200 bg-cream-50/50 text-ink-muted hover:border-cream-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                    <span className="text-sm font-semibold">{meta.label}</span>
                    {active ? (
                      <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-accent-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTENT */}
          <div className="space-y-3.5 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
              Content
            </p>

            <label className="block space-y-1.5">
              <span className="block text-[13px] font-semibold text-ink dark:text-cream-100">
                Hook
              </span>
              <input
                type="text"
                value={form.hook}
                onChange={(e) => update("hook", e.target.value)}
                placeholder='e.g. "Raya promo: BOGO on kuih"'
                maxLength={280}
                className={inputCx}
              />
              <span className="block text-[11px] text-ink-subtle">
                One-line idea (≤ 280 chars). Used as the title in the calendar
                chip.
              </span>
            </label>

            <label className="block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink dark:text-cream-100">
                  Caption
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
                  <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
                  Maya rewrite
                </span>
              </div>
              <textarea
                value={form.caption}
                onChange={(e) => update("caption", e.target.value)}
                placeholder="Sambal kering, sambal basah, sambal bawang, sambal hijau — sumber Hari Raya kami dah ready. Tunggu apa lagi?"
                rows={4}
                className={`${inputCx} resize-y`}
                maxLength={4000}
              />
              <div className="rounded-lg bg-accent-50 px-3 py-2 text-[12px] dark:bg-accent-700/15">
                <p className="font-semibold text-accent-700 dark:text-accent-200">
                  Maya suggestion
                </p>
                <p className="mt-0.5 text-ink-muted dark:text-cream-400">
                  Add a sensory hook in the first line (smell, taste). Mention
                  scarcity (&quot;limited batch&quot;) to drive urgency.
                </p>
              </div>
            </label>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <p className="text-[13px] font-semibold text-ink dark:text-cream-100">
                Hashtags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HASHTAG_SUGGESTIONS.map((h) => {
                  const active = hashtags.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleHashtag(h)}
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        active
                          ? "bg-brand-500 text-white"
                          : "border border-cream-300 bg-white text-ink-muted hover:border-brand-300 hover:text-brand-700 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
              {hashtags.length > 0 ? (
                <p className="text-[11px] text-ink-subtle">
                  {hashtags.length} hashtag{hashtags.length === 1 ? "" : "s"}{" "}
                  will be appended to the caption.
                </p>
              ) : null}
            </div>

            {/* Media slots */}
            <div className="space-y-1.5">
              <p className="text-[13px] font-semibold text-ink dark:text-cream-100">
                Media
              </p>
              <ContentMediaUploader
                ref={mediaRef}
                onChange={handleMediaChange}
              />
            </div>
          </div>

          {warning ? (
            <p
              role="status"
              className="rounded-md bg-[#FDF2DC] px-3 py-2 text-sm text-[#8C5C0A] dark:bg-[#3A2A0A] dark:text-[#F5C97A]"
            >
              {warning}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-[#F8DDD9] px-3 py-2 text-sm text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
            >
              {error}
            </p>
          ) : null}
        </div>

        {/* RIGHT — Schedule + Preview */}
        <div className="space-y-4">
          {/* SCHEDULE */}
          <div className="space-y-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
              Schedule
            </p>

            <div className="space-y-1.5">
              <p className="text-[13px] font-semibold text-ink dark:text-cream-100">
                Status
              </p>
              <div className="flex gap-2">
                {(["drafted", "scheduled"] as const).map((s) => {
                  const active = form.status === s;
                  const tone = STATUS_TONE[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update("status", s)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize ${
                        active
                          ? `border-brand-500 ${tone.bg} ${tone.text}`
                          : "border-cream-300 bg-white text-ink-muted hover:border-brand-300 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[13px] font-semibold text-ink dark:text-cream-100">
                Scheduled date &amp; time (MYT)
              </p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => update("scheduledDate", e.target.value)}
                  className={inputCx}
                />
                <input
                  type="time"
                  value={form.scheduledTime}
                  onChange={(e) => update("scheduledTime", e.target.value)}
                  className={inputCx}
                  style={{ width: "110px" }}
                />
              </div>
            </div>

            <div className="rounded-lg bg-accent-50 p-3 dark:bg-accent-700/15">
              <div className="flex items-start gap-2">
                <Sparkles
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-700 dark:text-accent-200"
                  strokeWidth={2.5}
                />
                <p className="text-[12px] leading-snug text-ink dark:text-cream-100">
                  <span className="font-semibold text-accent-700 dark:text-accent-200">
                    Maya · Best time:
                  </span>{" "}
                  Tue–Thu, 9–11 AM MYT for {channelMeta.label}. Your audience is
                  most active then.
                </p>
              </div>
            </div>
          </div>

          {/* PREVIEW */}
          <div className="space-y-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
                Preview
              </p>
              <span className={`text-[11px] font-semibold ${channelMeta.tone.split(" ").find((c) => c.startsWith("text-")) ?? "text-ink-muted"}`}>
                {channelMeta.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-200 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                BN
              </span>
              <span className="text-xs font-semibold text-ink dark:text-cream-100">
                @bantuniaga
              </span>
              <MoreHorizontal
                className="ml-auto h-4 w-4 text-ink-muted"
                strokeWidth={2}
              />
            </div>
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-accent-100 dark:bg-accent-700/20">
              {mediaState.firstImagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaState.firstImagePreviewUrl}
                  alt="Post preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon
                  className="h-10 w-10 text-accent-500 opacity-60"
                  strokeWidth={1.5}
                />
              )}
            </div>
            <div className="flex items-center gap-3 text-ink-muted dark:text-cream-400">
              <Heart className="h-5 w-5" strokeWidth={2} />
              <MessageCircle className="h-5 w-5" strokeWidth={2} />
              <Send className="h-5 w-5" strokeWidth={2} />
              <Bookmark className="ml-auto h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-[12px] leading-snug">
              <p className="text-ink dark:text-cream-100">
                <span className="font-semibold">@bantuniaga</span>{" "}
                {previewCaptionLines.length === 0 ? (
                  <span className="italic text-ink-subtle">
                    Your caption will appear here…
                  </span>
                ) : (
                  previewCaptionLines.join(" ")
                )}
              </p>
              {hashtags.length > 0 ? (
                <p className="mt-1 text-brand-700 dark:text-brand-200">
                  {hashtags.slice(0, 6).join(" ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
          Auto-saves on submit. Status: <strong>{form.status}</strong>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/marketing/content")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit("drafted")}
            disabled={busy || mediaState.uploadingCount > 0}
            title={
              mediaState.uploadingCount > 0
                ? "Wait for media uploads to finish."
                : undefined
            }
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            Save as draft
          </button>
          <button
            type="submit"
            disabled={busy || mediaState.uploadingCount > 0}
            title={
              mediaState.uploadingCount > 0
                ? "Wait for media uploads to finish."
                : undefined
            }
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
          >
            {busy
              ? "Saving…"
              : mediaState.uploadingCount > 0
                ? "Uploading…"
                : "Schedule"}
          </button>
        </div>
      </div>
    </form>
  );
}

const inputCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";
