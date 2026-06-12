"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
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
 *  - `mode="create"`  → POST  /api/marketing/content
 *  - `mode="edit"`    → PATCH /api/marketing/content/[id]
 *
 * Status moves use the same PATCH path; the server-side transition
 * guard enforces `idea → drafted → scheduled → posted` (with backward
 * transitions allowed, except `posted` which is terminal). Submit
 * errors surface inline; the page redirects to the detail view on
 * success.
 *
 * Media attachments: in `create` mode we collect file_id uuids in a
 * local list and pass them on POST so they land via the single
 * "media_file_ids" param. In `edit` mode each add/remove hits
 * `/api/marketing/content/[id]/media` directly so we can refresh
 * incrementally without re-submitting the whole entry.
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

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
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
  const [pendingMediaIds, setPendingMediaIds] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy) return;
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
            media_file_ids: pendingMediaIds,
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

  async function attachMedia(): Promise<void> {
    const trimmed = mediaInput.trim();
    if (!trimmed) return;
    if (!isUuid(trimmed)) {
      setError("Media file_id must be a UUID (Admin Storage stub for v1).");
      return;
    }
    setError(null);

    if (mode === "create") {
      // Stash; will be sent with the POST.
      if (!pendingMediaIds.includes(trimmed)) {
        setPendingMediaIds((s) => [...s, trimmed]);
      }
      setMediaInput("");
      return;
    }

    if (!initial) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/marketing/content/${initial.id}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_id: trimmed,
            position: media.length,
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as {
        action?: string;
        media?: { file_id?: string; position?: number };
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setMedia((s) =>
        s.find((m) => m.file_id === trimmed)
          ? s
          : [...s, { file_id: trimmed, position: body?.media?.position ?? s.length }],
      );
      setMediaInput("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function detachMedia(fileId: string): Promise<void> {
    if (mode === "create") {
      setPendingMediaIds((s) => s.filter((id) => id !== fileId));
      return;
    }
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
          <CardTitle className="text-base">Media attachments</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-xs text-ink-muted dark:text-cream-400">
            v1 stub: paste an Admin Storage file uuid. Real thumbnails arrive once
            Admin ships its <code>files</code> table + signed-URL endpoint (D6).
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="flex-1 rounded-md border border-cream-300 bg-panel-light px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={attachMedia}
              disabled={busy || mediaInput.trim().length === 0}
            >
              Attach
            </Button>
          </div>

          {mode === "create" && pendingMediaIds.length > 0 && (
            <ul className="space-y-1 text-xs">
              {pendingMediaIds.map((fid) => (
                <li
                  key={fid}
                  className="flex items-center justify-between rounded border border-cream-200 px-2 py-1 dark:border-hairline-dark"
                >
                  <code className="break-all text-[11px] text-ink dark:text-cream-100">
                    {fid}
                  </code>
                  <button
                    type="button"
                    onClick={() => detachMedia(fid)}
                    className="text-[11px] text-status-danger hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {mode === "edit" && (
            <div className="space-y-2">
              <ContentMediaList media={media} />
              {media.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {media.map((m) => (
                    <li
                      key={m.file_id}
                      className="flex items-center justify-between rounded border border-cream-200 px-2 py-1 dark:border-hairline-dark"
                    >
                      <code className="break-all text-[11px] text-ink dark:text-cream-100">
                        {m.file_id}
                      </code>
                      <button
                        type="button"
                        onClick={() => detachMedia(m.file_id)}
                        disabled={busy}
                        className="text-[11px] text-status-danger hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
