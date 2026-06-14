"use client";

import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { CONSENT_CATALOG } from "@/lib/privacy/catalog";
import type { ConsentKind, UserConsent } from "@/lib/privacy/types";

interface Props {
  initialConsents: UserConsent[];
}

export function ConsentMatrix({ initialConsents }: Props) {
  const [consents, setConsents] = useState<UserConsent[]>(initialConsents);
  const [dirty, setDirty] = useState<Map<ConsentKind, boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byKind = useMemo(() => {
    const m = new Map<ConsentKind, UserConsent>();
    for (const c of consents) m.set(c.kind, c);
    return m;
  }, [consents]);

  function toggle(kind: ConsentKind, granted: boolean) {
    setDirty((prev) => {
      const next = new Map(prev);
      next.set(kind, granted);
      return next;
    });
  }

  async function save() {
    if (dirty.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: Array.from(dirty.entries()).map(([kind, granted]) => ({
            kind,
            granted,
          })),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { consents: UserConsent[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error?.message ?? "Could not save preferences.");
        return;
      }
      setConsents(json.data.consents);
      setDirty(new Map());
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-cream-200 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-cream-100">
            Consent preferences
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Toggle each consent on or off. Required consents (Terms, Privacy
            Notice) can only be withdrawn by closing the account.
          </p>
        </div>
        {savedAt ? (
          <p className="text-xs text-status-success">
            Saved at {savedAt.toLocaleTimeString("en-MY")}
          </p>
        ) : null}
      </header>

      <ul className="mt-4 divide-y divide-cream-200 dark:divide-hairline-dark">
        {CONSENT_CATALOG.map((descriptor) => {
          const consent = byKind.get(descriptor.kind);
          const dirtyVal = dirty.get(descriptor.kind);
          const granted =
            dirtyVal !== undefined ? dirtyVal : consent?.granted ?? descriptor.defaultGranted;
          return (
            <li
              key={descriptor.kind}
              className="flex items-start justify-between gap-4 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  {descriptor.title}{" "}
                  {descriptor.required ? (
                    <span className="ml-1 rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-subtle dark:bg-hairline-dark dark:text-cream-400">
                      Required
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  {descriptor.description}
                </p>
                {consent?.grantedAt ? (
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    Granted {new Date(consent.grantedAt).toLocaleDateString("en-MY")}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={granted}
                disabled={descriptor.required || busy}
                onClick={() => toggle(descriptor.kind, !granted)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  granted
                    ? "bg-brand-500"
                    : "bg-cream-300 dark:bg-hairline-dark"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    granted ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={busy || dirty.size === 0}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-subtle dark:disabled:bg-hairline-dark dark:disabled:text-cream-400"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <Check className="h-4 w-4" strokeWidth={2} />
        )}
        Save preferences
        {dirty.size > 0 ? (
          <span className="ml-1 text-xs opacity-80">({dirty.size} change{dirty.size > 1 ? "s" : ""})</span>
        ) : null}
      </button>
    </section>
  );
}
