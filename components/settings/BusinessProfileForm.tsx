"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { MALAYSIA_STATE_OPTIONS } from "@/lib/settings/state-options";
import { settingsClasses } from "@/lib/settings/theme";
import { cn } from "@/lib/utils/cn";

export interface BusinessProfileFormProps {
  initial: {
    name: string;
    state_code: string | null;
    registration_no: string | null;
    contact_line: string | null;
  };
  canEdit: boolean;
}

export function BusinessProfileForm({ initial, canEdit }: BusinessProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [stateCode, setStateCode] = useState(initial.state_code ?? "");
  const [registrationNo, setRegistrationNo] = useState(initial.registration_no ?? "");
  const [contactLine, setContactLine] = useState(initial.contact_line ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedStateLabel = useMemo(
    () => MALAYSIA_STATE_OPTIONS.find((s) => s.code === stateCode)?.label ?? null,
    [stateCode],
  );

  const dirty = useMemo(
    () =>
      name !== initial.name ||
      stateCode !== (initial.state_code ?? "") ||
      registrationNo !== (initial.registration_no ?? "") ||
      contactLine !== (initial.contact_line ?? ""),
    [name, stateCode, registrationNo, contactLine, initial],
  );

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);

    if (!stateCode) {
      setSaveError("Pick your business state — it drives public holidays and leave.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/settings/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          state_code: stateCode,
          registration_no: registrationNo.trim() || null,
          contact_line: contactLine.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(json?.message ?? json?.error ?? "Could not save. Try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const disabled = !canEdit || pending;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {!canEdit ? (
        <p className="rounded-lg border border-cream-200 bg-cream-50/50 px-3 py-2 text-xs text-ink-muted dark:border-hairline-dark dark:bg-hairline-dark/20 dark:text-cream-400">
          Read-only — only the owner can update business details.
        </p>
      ) : null}

      {saveError ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {saveError}
        </div>
      ) : null}

      {saved ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-3 py-2 text-sm text-status-success">
          Saved.
        </div>
      ) : null}

      <section className="rounded-xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
        <div className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            Identity
          </h2>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <label className={settingsClasses.label}>
            <span>Business name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled}
              required
              placeholder="e.g. Kedai Runcit Ali"
              className={settingsClasses.input}
            />
          </label>

          <label className={settingsClasses.label}>
            <span>State</span>
            <select
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              disabled={disabled}
              required
              className={settingsClasses.input}
            >
              <option value="" disabled>
                Select state…
              </option>
              {MALAYSIA_STATE_OPTIONS.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.label}
                </option>
              ))}
            </select>
            {selectedStateLabel ? (
              <span
                className={cn(
                  "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  settingsClasses.chip,
                )}
              >
                Holidays import for {selectedStateLabel}
              </span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
        <div className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            Registration & contact
          </h2>
          <p className="text-[11px] text-ink-muted dark:text-cream-400">
            Optional — printed on receipts
          </p>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <label className={settingsClasses.label}>
            <span>SSM number</span>
            <input
              value={registrationNo}
              onChange={(e) => setRegistrationNo(e.target.value)}
              disabled={disabled}
              placeholder="e.g. 202301234567"
              className={settingsClasses.input}
            />
          </label>

          <label className={settingsClasses.label}>
            <span>Phone or email</span>
            <input
              value={contactLine}
              onChange={(e) => setContactLine(e.target.value)}
              disabled={disabled}
              placeholder="e.g. +60 12-345 6789"
              className={settingsClasses.input}
            />
          </label>
        </div>
      </section>

      {canEdit ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 bg-white px-4 py-3 shadow-sm dark:border-hairline-dark dark:bg-panel-dark sm:px-5">
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </p>
          <button
            type="submit"
            disabled={disabled || !dirty}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-50",
              settingsClasses.btnPrimary,
            )}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      ) : null}
    </form>
  );
}
