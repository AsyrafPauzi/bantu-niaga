"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import {
  ContentMediaUploader,
  type ContentMediaUploaderHandle,
} from "./ContentMediaUploader";
import type {
  ContentChannel,
  ContentEntryRow,
  ContentMediaRow,
  ContentStatus,
} from "./types";
import { ContentMediaList } from "./ContentMediaList";

/**
 * Shared form for create + edit of a content_plan entry.
 *
 * Media uploads use the marketing-media bucket via ContentMediaUploader
 * (same as New post). Edit mode attaches each upload immediately; create
 * mode batches attach after the entry is created.
 */

const CHANNELS: ContentChannel[] = ["tiktok", "instagram", "facebook"];
const STATUSES: ContentStatus[] = ["idea", "drafted", "scheduled", "posted"];

interface ContentEntryFormProps {
  mode: "create" | "edit";
  initial?: ContentEntryRow;
  /** Pre-fill the scheduled date from the calendar "+ Add" click. */
  prefillDateIso?: string;
  initialMedia?: ContentMediaRow[];
  className?: string;
}

interface FormState {
  channel: ContentChannel;
  status: ContentStatus;
  scheduledDate: string; // YYYY-MM-DD in MYT
  scheduledTime: string; // HH:mm in MYT
  hook: string;
  caption: string;
}

const MYT_OFFSET = "+08:00";

function utcIsoToMytParts(iso: string | null): {
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

export function ContentEntryForm({
  mode,
  initial,
  prefillDateIso,
  initialMedia,
  className,
}: ContentEntryFormProps) {
  const router = useRouter();
  const initialParts = useMemo(
    () => utcIsoToMytParts(initial?.scheduled_at ?? null),
    [initial?.scheduled_at],
  );

  const [form, setForm] = useState<FormState>({
    channel: initial?.channel ?? "tiktok",
    status: initial?.status ?? "idea",
    scheduledDate:
      initialParts.date || (prefillDateIso ? prefillDateIso : ""),
    scheduledTime: initialParts.time,
    hook: initial?.hook ?? "",
    caption: initial?.caption ?? "",
  });
  const [media, setMedia] = useState<ContentMediaRow[]>(initialMedia ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<ContentMediaUploaderHandle | null>(null);

  const handleFileUploaded = useCallback(
    async (fileId: string) => {
      if (mode !== "edit" || !initial) return;
      try {
        const res = await fetch(`/api/marketing/content/${initial.id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_id: fileId,
            position: media.length,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
          return;
        }
        setMedia((s) =>
          s.some((m) => m.file_id === fileId)
            ? s
            : [...s, { file_id: fileId, position: s.length }],
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not attach media.");
      }
    },
    [mode, initial, media.length, router],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy) return;
    if (mediaRef.current?.isUploading()) {
      setError("Wait for media uploads to finish before saving.");
      return;
    }
    setBusy(true);
    setError(null);

    const scheduledAt = mytPartsToUtcIso(form.scheduledDate, form.scheduledTime);

    try {
      if (mode === "create") {
        const res = await fetch("/api/marketing/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: form.channel,
            status: form.status,
            scheduled_at: scheduledAt,
            hook: form.hook || null,
            caption: form.caption || null,
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
          const attachRes = await fetch("/api/marketing/media/attach-to-content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content_plan_id: id,
              file_ids: fileIds,
            }),
          });
          if (!attachRes.ok) {
            setError("Post created but some media could not be attached.");
          }
        }
        if (id) {
          router.push(`/marketing/content/${id}`);
          router.refresh();
        }
        return;
      }

      // Edit mode
      if (!initial) return;
      const patch: Record<string, unknown> = {};
      if (form.channel !== initial.channel) patch.channel = form.channel;
      if (form.status !== initial.status) patch.status = form.status;
      const initialIso = initial.scheduled_at ?? null;
      if (scheduledAt !== initialIso) patch.scheduled_at = scheduledAt;
      const initHook = initial.hook ?? "";
      const initCaption = initial.caption ?? "";
      if (form.hook !== initHook) patch.hook = form.hook || null;
      if (form.caption !== initCaption) patch.caption = form.caption || null;

      if (Object.keys(patch).length === 0) {
        setError("No changes to save.");
        return;
      }

      const res = await fetch(`/api/marketing/content/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
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
      router.push(`/marketing/content/${initial.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function detachMedia(fileId: string): Promise<void> {
    if (!initial) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/marketing/content/${initial.id}/media?file_id=${encodeURIComponent(fileId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setMedia((s) => s.filter((m) => m.file_id !== fileId));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={cn("space-y-4", className)} onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "New content entry" : "Edit content entry"}
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <SelectField
            label="Platform"
            value={form.channel}
            onChange={(v) => update("channel", v as ContentChannel)}
            options={CHANNELS.map((c) => ({
              value: c,
              label: PLATFORM_LABEL[c],
            }))}
          />
          <SelectField
            label="Status"
            value={form.status}
            onChange={(v) => update("status", v as ContentStatus)}
            options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            help="idea → drafted → scheduled → posted. Backwards transitions allowed; 'posted' is final."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Scheduled date (MYT)"
              type="date"
              value={form.scheduledDate}
              onChange={(v) => update("scheduledDate", v)}
              help="Leave blank for plain ideas."
            />
            <TextField
              label="Scheduled time"
              type="time"
              value={form.scheduledTime}
              onChange={(v) => update("scheduledTime", v)}
              help="Defaults to 09:00 MYT if blank but date is set."
            />
          </div>

          <TextField
            label="Hook"
            value={form.hook}
            onChange={(v) => update("hook", v)}
            placeholder="e.g. 'Raya promo: BOGO on kuih'"
            help="One-line idea (≤ 280 chars). Used as the title in the calendar chip."
          />

          <TextAreaField
            label="Caption draft"
            value={form.caption}
            onChange={(v) => update("caption", v)}
            rows={5}
            placeholder="Free-form caption draft. Owner copies it into TikTok/IG/FB when posting."
          />

          {error && (
            <p
              role="alert"
              className="rounded-md bg-[#F8DDD9] px-3 py-2 text-sm text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
            >
              {error}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {mode === "edit" && media.length > 0 ? (
            <div className="space-y-2">
              <ContentMediaList media={media} />
              <div className="flex flex-wrap gap-2">
                {media.map((m, index) => (
                  <button
                    key={m.file_id}
                    type="button"
                    onClick={() => detachMedia(m.file_id)}
                    disabled={busy}
                    className="text-xs font-semibold text-status-danger hover:underline disabled:opacity-50"
                  >
                    Remove file {index + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <ContentMediaUploader
            ref={mediaRef}
            onFileUploaded={
              mode === "edit" ? (id) => void handleFileUploaded(id) : undefined
            }
          />
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy
            ? "Saving…"
            : mode === "create"
              ? "Create entry"
              : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/marketing/content")}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

const PLATFORM_LABEL: Record<ContentChannel, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  drafted: "Drafted",
  scheduled: "Scheduled",
  posted: "Posted",
};

// ─────────────────────────────────────────────────────────────────────
// Field primitives — kept local so the form can ship without depending
// on a shared field library.
// ─────────────────────────────────────────────────────────────────────

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
  required,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink dark:text-cream-100">
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      <input
        className={cn(
          "mt-1 w-full rounded-md border border-cream-300 bg-panel-light px-3 py-2 text-sm text-ink",
          "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400",
          "dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        required={required}
      />
      {help && (
        <span className="mt-1 block text-xs text-ink-muted dark:text-cream-400">
          {help}
        </span>
      )}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink dark:text-cream-100">
        {label}
      </span>
      <textarea
        className={cn(
          "mt-1 w-full rounded-md border border-cream-300 bg-panel-light px-3 py-2 text-sm text-ink",
          "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400",
          "dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
        )}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  help?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink dark:text-cream-100">
        {label}
      </span>
      <select
        className={cn(
          "mt-1 w-full rounded-md border border-cream-300 bg-panel-light px-3 py-2 text-sm text-ink",
          "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400",
          "dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && (
        <span className="mt-1 block text-xs text-ink-muted dark:text-cream-400">
          {help}
        </span>
      )}
    </label>
  );
}
