"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Phone, X } from "lucide-react";
import { MergePromptBanner } from "@/components/marketing/MergePromptBanner";
import { cn } from "@/lib/utils/cn";

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

interface PromptState {
  existingCustomerId: string;
  existingName: string;
}

const SUGGESTED_TAGS = ["Wholesale", "Regular", "Walk-in"];

export function NewCustomerFormPencil() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
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
      setError("Each tag must be 40 characters or fewer.");
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
          source: "manual",
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
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
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

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {prompt ? (
        <MergePromptBanner
          existingCustomerId={prompt.existingCustomerId}
          existingName={prompt.existingName}
          onMerge={handleMerge}
          onKeepSeparate={handleKeepSeparate}
          disabled={busy}
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="border-b border-cream-200 bg-violet-50/50 px-5 py-3 dark:border-hairline-dark dark:bg-violet-950/20 sm:px-6">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            Contact details
          </p>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            Name is required. Phone helps WhatsApp broadcasts and dedupe.
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2">
              <input
                type="text"
                required
                autoFocus
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Nur Aishah Rahman"
                className={inputCx}
              />
            </Field>

            <Field
              label="Phone"
              help="Malaysian numbers saved as +60 · used for dedupe"
            >
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  strokeWidth={2}
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="012-345 6789"
                  className={cn(inputCx, "pl-10")}
                />
              </div>
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="optional@email.com"
                className={inputCx}
              />
            </Field>

            <Field label="Address" className="sm:col-span-2">
              <textarea
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Street, city, postcode"
                rows={2}
                className={cn(inputCx, "resize-y")}
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-cream-200 bg-cream-50/40 px-5 py-4 dark:border-hairline-dark dark:bg-panel-dark/60 sm:px-6">
          <p className="mb-4 text-sm font-semibold text-ink dark:text-cream-100">
            Your labels
          </p>

          <div className="space-y-4">
            <Field
              label="Manual tags"
              help="Optional — VIP and dormant are computed from purchases, not typed here."
            >
              <div
                className={cn(inputCx, "flex min-h-[42px] flex-wrap items-center gap-1.5")}
                onClick={() =>
                  document.getElementById("new-cust-tag-input")?.focus()
                }
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(tag);
                      }}
                      aria-label={`Remove ${tag}`}
                      className="rounded-full hover:bg-violet-200/80 dark:hover:bg-violet-800/40"
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
                  placeholder={tags.length === 0 ? "Type and press Enter…" : ""}
                  className="min-w-[100px] flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
                />
              </div>
              {tags.length === 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUGGESTED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full border border-dashed border-violet-300 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/30"
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
                rows={3}
                placeholder="Preferences, allergies, how they found you…"
                className={cn(inputCx, "resize-y")}
              />
            </Field>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mx-5 mb-4 rounded-lg bg-status-danger/10 px-3 py-2 text-sm text-status-danger sm:mx-6"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-cream-200 px-5 py-4 dark:border-hairline-dark sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/marketing/customers")}
            disabled={busy}
            className="order-3 inline-flex items-center justify-center rounded-xl border border-cream-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-cream-100 disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 sm:order-1 sm:mr-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndAddAnother}
            disabled={busy || form.name.trim().length === 0}
            className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-900/50 dark:bg-panel-dark dark:text-violet-200 dark:hover:bg-violet-950/30"
          >
            Save &amp; add another
          </button>
          <button
            type="submit"
            disabled={busy || form.name.trim().length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save customer"}
          </button>
        </div>
      </div>
    </form>
  );
}

const inputCx =
  "w-full rounded-xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/30 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

function Field({
  label,
  required,
  help,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-[13px] font-semibold text-ink dark:text-cream-100">
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      {children}
      {help ? (
        <span className="block text-[11px] text-ink-muted dark:text-cream-400">
          {help}
        </span>
      ) : null}
    </label>
  );
}
