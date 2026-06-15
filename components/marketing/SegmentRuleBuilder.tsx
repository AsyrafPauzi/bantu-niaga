"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  AUTO_KEY_LABEL,
  AUTO_SEGMENT_KEYS,
  type AutoSegmentKey,
  type SegmentRules,
} from "@/lib/marketing/segments-rules";

/**
 * Pencil-style rule builder used by both the create page and the
 * edit modal on the detail page.
 *
 * Emits a normalized SegmentRules JSON via `onChange` whenever any
 * field updates. The "≈ N matches" preview lives here too — it
 * debounces calls to /api/marketing/segments/preview-count.
 */

const CUSTOMER_SOURCES: { value: SegmentRules["sources"] extends Array<infer T> | undefined ? T : never; label: string }[] = [
  { value: "pos", label: "POS" },
  { value: "booking", label: "Booking" },
  { value: "lead_conversion", label: "Lead conversion" },
  { value: "csv_import", label: "CSV import" },
  { value: "manual", label: "Manual" },
  { value: "public_booking_page", label: "Public booking page" },
];

export interface SegmentRuleBuilderProps {
  /** Form name input — separate from the rules object. */
  name: string;
  onNameChange: (name: string) => void;
  /** Current rules JSON. Treated as a controlled value. */
  rules: SegmentRules;
  onRulesChange: (rules: SegmentRules) => void;
  /** When false, all inputs are read-only (used for auto segments). */
  editable?: boolean;
  /** Optional initial preview count; the builder will refresh on first render too. */
  initialPreviewCount?: number;
  /** Hide the live preview row (e.g. when rendered inside an edit modal that has its own counter). */
  hidePreview?: boolean;
}

export function SegmentRuleBuilder({
  name,
  onNameChange,
  rules,
  onRulesChange,
  editable = true,
  initialPreviewCount,
  hidePreview = false,
}: SegmentRuleBuilderProps) {
  // Local tag-input buffers per chip-input (typing state that lives
  // outside the rules JSON itself).
  const [tagsAnyInput, setTagsAnyInput] = useState("");
  const [manualTagsInput, setManualTagsInput] = useState("");

  function patch(patchObj: Partial<SegmentRules>) {
    if (!editable) return;
    const next: SegmentRules = { ...rules, ...patchObj };
    // Drop empty array / undefined keys so the JSON stays compact.
    for (const k of Object.keys(next) as (keyof SegmentRules)[]) {
      const v = next[k];
      if (v === undefined || (Array.isArray(v) && v.length === 0)) {
        delete next[k];
      }
    }
    onRulesChange(next);
  }

  function addToList(
    key: "tags_any" | "manual_tags_any",
    raw: string,
    clearInput: () => void,
  ) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (trimmed.length > 40) return;
    const current = rules[key] ?? [];
    if (current.includes(trimmed)) {
      clearInput();
      return;
    }
    if (current.length >= 20) return;
    patch({ [key]: [...current, trimmed] } as Partial<SegmentRules>);
    clearInput();
  }

  function removeFromList(key: "tags_any" | "manual_tags_any", value: string) {
    const current = rules[key] ?? [];
    patch({
      [key]: current.filter((v) => v !== value),
    } as Partial<SegmentRules>);
  }

  function toggleSource(value: string) {
    const cast = value as NonNullable<SegmentRules["sources"]>[number];
    const current = rules.sources ?? [];
    const next = current.includes(cast)
      ? current.filter((s) => s !== cast)
      : ([...current, cast] as NonNullable<SegmentRules["sources"]>);
    patch({ sources: next });
  }

  function toggleAutoTag(value: AutoSegmentKey) {
    const current = rules.auto_tags_any ?? [];
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    patch({ auto_tags_any: next });
  }

  // ── Live preview count ────────────────────────────────────────────────
  const [previewCount, setPreviewCount] = useState<number | null>(
    initialPreviewCount ?? null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const rulesKey = useMemo(() => JSON.stringify(rules), [rules]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (hidePreview) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPreviewLoading(true);
    setPreviewError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/marketing/segments/preview-count", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: rulesKey,
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body?.message === "string"
              ? body.message
              : `preview returned ${res.status}`,
          );
        }
        const body = (await res.json()) as { count: number };
        if (!controller.signal.aborted) {
          setPreviewCount(body.count);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setPreviewError(
          e instanceof Error ? e.message : "preview failed",
        );
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [rulesKey, hidePreview]);

  const inputClass = (extra?: string) =>
    cn(
      "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:focus:ring-brand-900/40",
      !editable && "cursor-not-allowed opacity-60",
      extra,
    );

  return (
    <div className="space-y-6">
      {/* Name row */}
      <Field label="Segment name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => editable && onNameChange(e.target.value)}
          placeholder="e.g. Big spenders, last 90 days"
          maxLength={80}
          disabled={!editable}
          className={inputClass()}
        />
      </Field>

      {/* Tags any (mixed — matches manual + auto tag arrays). */}
      <Field
        label="Has any of these tags"
        helper="Matches either manual or auto tags. Press Enter to add."
      >
        <ChipInput
          value={rules.tags_any ?? []}
          input={tagsAnyInput}
          onInputChange={setTagsAnyInput}
          onAdd={(v) => addToList("tags_any", v, () => setTagsAnyInput(""))}
          onRemove={(v) => removeFromList("tags_any", v)}
          placeholder="facebook_lead, homestay_guest…"
          disabled={!editable}
        />
      </Field>

      {/* Spend range */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Min total spend (MYR)">
          <input
            type="number"
            min={0}
            step={1}
            value={rules.min_spend_myr ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              patch({
                min_spend_myr: v === "" ? undefined : Number(v),
              });
            }}
            disabled={!editable}
            className={inputClass()}
            placeholder="0"
          />
        </Field>
        <Field label="Max total spend (MYR)" helper="Leave empty for no cap.">
          <input
            type="number"
            min={0}
            step={1}
            value={rules.max_spend_myr ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              patch({
                max_spend_myr: v === "" ? undefined : Number(v),
              });
            }}
            disabled={!editable}
            className={inputClass()}
            placeholder="No cap"
          />
        </Field>
      </div>

      {/* Inactive days */}
      <Field
        label="Inactive for at least N days"
        helper="Last purchase older than this. Customers who never purchased are included."
      >
        <input
          type="number"
          min={0}
          step={1}
          value={rules.inactive_days ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            patch({
              inactive_days: v === "" ? undefined : Number(v),
            });
          }}
          disabled={!editable}
          className={inputClass()}
          placeholder="e.g. 90"
        />
      </Field>

      {/* Sources */}
      <Field
        label="Source"
        helper="Customer.source IN (any of selected)."
      >
        <div className="flex flex-wrap gap-2">
          {CUSTOMER_SOURCES.map((s) => {
            const active = (rules.sources ?? []).includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSource(s.value as string)}
                disabled={!editable}
                className={cn(
                  "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-cream-300 bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
                  !editable && "cursor-not-allowed opacity-60",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Manual tags */}
      <Field
        label="Manual tags include any of"
        helper="Press Enter to add. Restricts to customers tagged manually with these strings."
      >
        <ChipInput
          value={rules.manual_tags_any ?? []}
          input={manualTagsInput}
          onInputChange={setManualTagsInput}
          onAdd={(v) =>
            addToList("manual_tags_any", v, () => setManualTagsInput(""))
          }
          onRemove={(v) => removeFromList("manual_tags_any", v)}
          placeholder="wholesale, repeat, lunch-rush…"
          disabled={!editable}
        />
      </Field>

      {/* Auto tags */}
      <Field
        label="Auto tags include any of"
        helper="Same five auto-tags computed from spend / recency."
      >
        <div className="flex flex-wrap gap-2">
          {AUTO_SEGMENT_KEYS.map((key) => {
            const active = (rules.auto_tags_any ?? []).includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleAutoTag(key)}
                disabled={!editable}
                className={cn(
                  "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-accent-500 bg-accent-500 text-white"
                    : "border-cream-300 bg-white text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
                  !editable && "cursor-not-allowed opacity-60",
                )}
              >
                {AUTO_KEY_LABEL[key]}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Preview row */}
      {hidePreview ? null : (
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-200">
          <div className="flex items-center gap-2">
            {previewLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
            ) : null}
            <span>
              {previewError
                ? `Preview failed: ${previewError}`
                : previewCount === null
                  ? "Computing matches…"
                  : `≈ ${previewCount.toLocaleString()} customer${previewCount === 1 ? "" : "s"} match this segment`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  helper,
  required,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-ink dark:text-cream-100">
        {label}
        {required ? <span className="text-status-danger"> *</span> : null}
      </span>
      {children}
      {helper ? (
        <span className="block text-xs text-ink-muted dark:text-cream-400">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function ChipInput({
  value,
  input,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
  disabled,
}: {
  value: string[];
  input: string;
  onInputChange: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-2 py-1.5 shadow-card focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 dark:border-hairline-dark dark:bg-panel-dark",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-xs font-medium text-ink-muted dark:bg-hairline-dark dark:text-cream-300"
        >
          {t}
          {disabled ? null : (
            <button
              type="button"
              onClick={() => onRemove(t)}
              className="hover:text-status-danger"
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          )}
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            onAdd(input);
          } else if (e.key === "Backspace" && input === "" && value.length > 0) {
            onRemove(value[value.length - 1]);
          }
        }}
        onBlur={() => {
          if (input.trim()) onAdd(input);
        }}
        placeholder={value.length === 0 ? placeholder : ""}
        disabled={disabled}
        className="flex-1 min-w-32 bg-transparent px-2 py-1 text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100 dark:placeholder:text-cream-400"
      />
    </div>
  );
}
