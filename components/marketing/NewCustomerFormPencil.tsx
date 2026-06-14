"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Info, X } from "lucide-react";
import { MergePromptBanner } from "@/components/marketing/MergePromptBanner";
import { cn } from "@/lib/utils/cn";

/**
 * Pencil-aligned New Customer form. Two-column rows, section eyebrows,
 * pill-input tags, custom footer. Calls the same
 * POST /api/marketing/customers + merge-prompt logic as the legacy
 * CustomerForm (mode="create").
 */

interface FormState {
  name: string;
  source: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

interface PromptState {
  existingCustomerId: string;
  existingName: string;
}

const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "pos", label: "POS" },
  { value: "booking", label: "Booking" },
  { value: "lead_conversion", label: "Lead conversion" },
  { value: "csv_import", label: "CSV import" },
  { value: "public_booking_page", label: "Public booking page" },
];

const SUGGESTED_TAGS = ["Halal-conscious", "Bulk buyer", "Walk-in"];

export function NewCustomerFormPencil() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    source: "manual",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function addTag(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    if (tags.length >= 20) {
      setError("Maximum 20 manual tags.");
      return;
    }
    if (trimmed.length > 40) {
      setError("Each tag must be ≤ 40 chars.");
      return;
    }
    setTags((s) => [...s, trimmed]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((s) => s.filter((t) => t !== tag));
  }

  async function submit(force: boolean): Promise<{ ok: boolean; created?: string }> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          manual_tags: tags,
          notes: form.notes || undefined,
          source: form.source,
          force_create: force,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        action?: "created" | "merged" | "prompt";
        customer_id?: string;
        existing_customer_id?: string;
        existing_name?: string | null;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return { ok: false };
      }
      if (body?.action === "prompt" && body.existing_customer_id) {
        setPrompt({
          existingCustomerId: body.existing_customer_id,
          existingName: body.existing_name ?? "(unknown)",
        });
        return { ok: false };
      }
      setPrompt(null);
      setSavedAt(Date.now());
      return { ok: true, created: body?.customer_id };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const result = await submit(false);
    if (result.ok && result.created) {
      router.push(`/marketing/customers/${result.created}`);
      router.refresh();
    }
  }

  async function handleSaveAndAddAnother() {
    if (busy) return;
    const result = await submit(false);
    if (result.ok) {
      setForm({
        name: "",
        source: form.source,
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
      setTags([]);
      setTagInput("");
      router.refresh();
    }
  }

  async function handleMerge() {
    if (!prompt) return;
    router.push(`/marketing/customers/${prompt.existingCustomerId}`);
  }

  async function handleKeepSeparate() {
    const result = await submit(true);
    if (result.ok && result.created) {
      router.push(`/marketing/customers/${result.created}`);
      router.refresh();
    }
  }

  const savedAgo = savedAt
    ? `Auto-saved as draft ${Math.max(1, Math.round((Date.now() - savedAt) / 1000))}s ago`
    : null;

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {prompt && (
        <MergePromptBanner
          existingCustomerId={prompt.existingCustomerId}
          existingName={prompt.existingName}
          onMerge={handleMerge}
          onKeepSeparate={handleKeepSeparate}
          disabled={busy}
        />
      )}

      <div className="space-y-6 rounded-xl border border-cream-200 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-7">
        {/* BASIC INFO */}
        <section className="space-y-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
            Basic info
          </p>

          {/* Row 1 — Name + Source */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Full name" required>
              <input
                type="text"
                required
                autoFocus
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Nur Aishah Binti Rahman"
                className={inputCx}
              />
            </Field>
            <Field label="Source">
              <select
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
                className={inputCx}
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Row 2 — Phone + Email */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field
              label="Phone (Malaysian)"
              help="Saved as +60 format · used for WhatsApp & dedupe"
            >
              <input
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="012-345 6789 or +60123456789"
                className={inputCx}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="customer@example.com"
                className={inputCx}
              />
            </Field>
          </div>

          {/* Row 3 — Address */}
          <Field label="Address">
            <textarea
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Street, city, state, postcode"
              rows={2}
              className={`${inputCx} resize-y`}
            />
          </Field>
        </section>

        {/* TAGS & NOTES */}
        <section className="space-y-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
            Tags &amp; notes
          </p>

          <Field
            label="Manual tags"
            help="AI auto-tags (VIP, Churn risk, etc.) are applied separately based on order history."
          >
            <div
              className={`${inputCx} flex flex-wrap items-center gap-1.5`}
              onClick={() =>
                document.getElementById("new-cust-tag-input")?.focus()
              }
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(tag);
                    }}
                    aria-label={`Remove ${tag}`}
                    className="rounded-full hover:bg-brand-100 dark:hover:bg-brand-800/40"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
              <input
                id="new-cust-tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  } else if (
                    e.key === "Backspace" &&
                    tagInput.length === 0 &&
                    tags.length > 0
                  ) {
                    removeTag(tags[tags.length - 1]);
                  }
                }}
                onBlur={() => {
                  if (tagInput.trim()) addTag(tagInput);
                }}
                placeholder={tags.length === 0 ? "Type to add…" : ""}
                className="min-w-[120px] flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100 dark:placeholder:text-cream-400"
              />
            </div>
            {tags.length === 0 ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-ink-subtle">Suggested:</span>
                {SUGGESTED_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="inline-flex items-center rounded-full border border-dashed border-cream-300 px-2 py-0.5 text-[11px] text-ink-muted hover:border-brand-300 hover:text-brand-700 dark:border-hairline-dark dark:hover:border-brand-700"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={4}
              placeholder="e.g. Prefers delivery before 5pm. Allergic to peanuts."
              className={`${inputCx} resize-y`}
            />
          </Field>
        </section>

        {error ? (
          <p
            role="alert"
            className="rounded-md bg-[#F8DDD9] px-3 py-2 text-sm text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
          {savedAgo ?? "Phone or email triggers dedup against your CRM"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/marketing/customers")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndAddAnother}
            disabled={busy || form.name.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            Save and add another
          </button>
          <button
            type="submit"
            disabled={busy || form.name.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save & schedule"}
          </button>
        </div>
      </div>
    </form>
  );
}

const inputCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-400/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5")}>
      <span className="block text-[13px] font-semibold text-ink dark:text-cream-100">
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      {children}
      {help ? (
        <span className="block text-[11px] text-ink-subtle">{help}</span>
      ) : null}
    </label>
  );
}
