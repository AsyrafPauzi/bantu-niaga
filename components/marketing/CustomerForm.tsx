"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { TagBadge } from "@/components/marketing/TagBadge";
import { MergePromptBanner } from "@/components/marketing/MergePromptBanner";
import { cn } from "@/lib/utils/cn";

/**
 * <CustomerForm> — single source of truth for create / edit-full /
 * edit-restricted modes.
 *
 *  - `create`            → POST /api/marketing/customers; surfaces
 *                          <MergePromptBanner> on `action: "prompt"`.
 *  - `edit-full`         → PATCH /api/marketing/customers/[id]
 *                          (X-Surface-Mode: desktop).
 *  - `edit-restricted`   → PATCH /api/marketing/customers/[id]
 *                          (X-Surface-Mode: mobile), notes / manual_tags
 *                          / phone only (decisions doc Q10).
 */

export type CustomerFormMode = "create" | "edit-full" | "edit-restricted";

interface ExistingCustomer {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  address: string | null;
  manual_tags: string[];
  notes: string | null;
}

interface CustomerFormProps {
  mode: CustomerFormMode;
  /** Required for the two edit modes; ignored in `create`. */
  initial?: ExistingCustomer;
  /** Where to navigate after a successful create / edit. */
  successHref?: string;
  className?: string;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  manualTagsText: string;
  notes: string;
}

interface PromptState {
  existingCustomerId: string;
  existingName: string;
}

function initialFromCustomer(customer: ExistingCustomer | undefined): FormState {
  return {
    name: customer?.name ?? "",
    phone: customer?.phone_e164 ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    manualTagsText: (customer?.manual_tags ?? []).join(", "),
    notes: customer?.notes ?? "",
  };
}

function parseManualTags(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function CustomerForm({
  mode,
  initial,
  successHref,
  className,
}: CustomerFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFromCustomer(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  const isMobile = mode === "edit-restricted";
  const isEdit = mode !== "create";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function submitCreate(force: boolean): Promise<void> {
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
          manual_tags: parseManualTags(form.manualTagsText),
          notes: form.notes || undefined,
          source: "manual",
          force_create: force,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | {
            action?: "created" | "merged" | "prompt";
            customer_id?: string;
            existing_customer_id?: string;
            existing_name?: string | null;
            error?: string;
            message?: string;
          }
        | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      if (body?.action === "prompt" && body.existing_customer_id) {
        setPrompt({
          existingCustomerId: body.existing_customer_id,
          existingName: body.existing_name ?? "(unknown)",
        });
        return;
      }
      setPrompt(null);
      const targetId = body?.customer_id ?? null;
      if (targetId) {
        router.push(successHref ?? `/marketing/customers/${targetId}`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(): Promise<void> {
    if (!initial) return;
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    if (!isMobile) {
      if (form.name !== initial.name) payload.name = form.name;
      if (form.email !== (initial.email ?? "")) {
        payload.email = form.email === "" ? null : form.email;
      }
      if (form.address !== (initial.address ?? "")) {
        payload.address = form.address === "" ? null : form.address;
      }
    }
    if (form.phone !== (initial.phone_e164 ?? "")) {
      payload.phone = form.phone === "" ? null : form.phone;
    }
    const newTags = parseManualTags(form.manualTagsText);
    const oldTags = [...(initial.manual_tags ?? [])].sort();
    const sortedNew = [...newTags].sort();
    if (
      oldTags.length !== sortedNew.length ||
      oldTags.some((v, i) => v !== sortedNew[i])
    ) {
      payload.manual_tags = newTags;
    }
    if (form.notes !== (initial.notes ?? "")) {
      payload.notes = form.notes === "" ? null : form.notes;
    }

    if (Object.keys(payload).length === 0) {
      setBusy(false);
      setError("No changes to save.");
      return;
    }

    try {
      const res = await fetch(`/api/marketing/customers/${initial.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Surface-Mode": isMobile ? "mobile" : "desktop",
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as
        | {
            action?: string;
            existing_customer_id?: string;
            existing_name?: string | null;
            error?: string;
            message?: string;
          }
        | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      if (body?.action === "prompt" && body.existing_customer_id) {
        setPrompt({
          existingCustomerId: body.existing_customer_id,
          existingName: body.existing_name ?? "(unknown)",
        });
        return;
      }
      router.push(successHref ?? `/marketing/customers/${initial.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy) return;
    if (mode === "create") {
      await submitCreate(false);
    } else {
      await submitEdit();
    }
  }

  async function handleMerge(): Promise<void> {
    if (!prompt) return;
    // The "Merge into existing" path on create surfaces the existing
    // customer as the winner: we have no draft row yet (create was
    // rejected), so the operator just navigates to the existing record
    // and edits it there.
    if (mode === "create") {
      router.push(`/marketing/customers/${prompt.existingCustomerId}`);
      return;
    }
    if (!initial) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/marketing/customers/${prompt.existingCustomerId}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winner_id: prompt.existingCustomerId,
            loser_id: initial.id,
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!res.ok) {
        setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push(`/marketing/customers/${prompt.existingCustomerId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleKeepSeparate(): Promise<void> {
    if (mode === "create") {
      await submitCreate(true);
    } else {
      setPrompt(null);
    }
  }

  return (
    <form className={cn("space-y-4", className)} onSubmit={handleSubmit}>
      {prompt && (
        <MergePromptBanner
          existingCustomerId={prompt.existingCustomerId}
          existingName={prompt.existingName}
          onMerge={handleMerge}
          onKeepSeparate={handleKeepSeparate}
          disabled={busy}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "New customer" : "Edit customer"}
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Name */}
          {isMobile ? (
            <ReadOnlyField label="Name" value={initial?.name ?? "—"} />
          ) : (
            <TextField
              label="Name"
              required
              value={form.name}
              onChange={(v) => update("name", v)}
              autoFocus={mode === "create"}
            />
          )}

          {/* Phone */}
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            placeholder="012-345 6789 or +60123456789"
            inputMode="tel"
            help="Malaysian or international E.164. Leave blank if unknown."
          />

          {/* Email */}
          {isMobile ? (
            <ReadOnlyField label="Email" value={initial?.email ?? "—"} />
          ) : (
            <TextField
              label="Email"
              value={form.email}
              onChange={(v) => update("email", v)}
              type="email"
              placeholder="customer@example.com"
            />
          )}

          {/* Address */}
          {isMobile ? (
            <ReadOnlyField label="Address" value={initial?.address ?? "—"} />
          ) : (
            <TextAreaField
              label="Address"
              value={form.address}
              onChange={(v) => update("address", v)}
              rows={2}
            />
          )}

          {/* Manual tags */}
          <TextField
            label="Manual tags"
            value={form.manualTagsText}
            onChange={(v) => update("manualTagsText", v)}
            placeholder="vip, kedai-runcit, online-only"
            help="Comma-separated. Each tag ≤ 40 chars, max 20 tags."
          />
          {parseManualTags(form.manualTagsText).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parseManualTags(form.manualTagsText).map((t) => (
                <TagBadge key={t} label={t} kind="manual" />
              ))}
            </div>
          )}

          {/* Notes */}
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={(v) => update("notes", v)}
            rows={4}
            placeholder="Free-form notes about this customer."
          />

          {isMobile && (
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Open this customer on desktop to edit name, email, or address.
            </p>
          )}

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

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
        </Button>
        {isEdit && initial && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              router.push(`/marketing/customers/${initial.id}`);
              router.refresh();
            }}
            disabled={busy}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Field primitives
// ─────────────────────────────────────────────────────────────────────

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  autoFocus?: boolean;
  inputMode?: "text" | "tel" | "email" | "url" | "search";
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
  required,
  autoFocus,
  inputMode,
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
        autoFocus={autoFocus}
        inputMode={inputMode}
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-sm font-medium text-ink-muted dark:text-cream-400">
        {label}
      </span>
      <p className="mt-1 text-sm text-ink dark:text-cream-100">{value}</p>
    </div>
  );
}
