"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

import { CONSENT_CATALOG } from "@/lib/privacy/catalog";
import type { ConsentKind, UserConsent } from "@/lib/privacy/types";

interface Props {
  initialConsents: UserConsent[];
}

export function ConsentMatrix({ initialConsents }: Props) {
  const router = useRouter();
  const [consents, setConsents] = useState<UserConsent[]>(initialConsents);
  const [savingKind, setSavingKind] = useState<ConsentKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConsents(initialConsents);
  }, [initialConsents]);

  const byKind = useMemo(() => {
    const m = new Map<ConsentKind, UserConsent>();
    for (const c of consents) m.set(c.kind, c);
    return m;
  }, [consents]);

  const grantedCount = CONSENT_CATALOG.filter((d) => {
    const consent = byKind.get(d.kind);
    return consent?.granted ?? d.defaultGranted;
  }).length;

  async function updateConsent(kind: ConsentKind, granted: boolean) {
    const descriptor = CONSENT_CATALOG.find((d) => d.kind === kind);
    if (!descriptor || descriptor.required) return;

    const previous = consents;
    setError(null);
    setSavingKind(kind);
    setConsents((current) =>
      current.map((c) => (c.kind === kind ? { ...c, granted } : c)),
    );

    try {
      const res = await fetch("/api/privacy/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ changes: [{ kind, granted }] }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { consents: UserConsent[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        setConsents(previous);
        setError(json.error?.message ?? "Could not save preference.");
        return;
      }
      setConsents(json.data.consents);
      router.refresh();
    } catch (e) {
      setConsents(previous);
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSavingKind(null);
    }
  }

  return (
    <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <ShieldCheck className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            Consent preferences
          </h2>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {grantedCount} of {CONSENT_CATALOG.length} on · saves immediately
            and is enforced across the app
          </p>
        </div>
      </div>

      <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
        {CONSENT_CATALOG.map((descriptor) => {
          const consent = byKind.get(descriptor.kind);
          const granted = consent?.granted ?? descriptor.defaultGranted;
          const rowBusy = savingKind === descriptor.kind;

          return (
            <li
              key={descriptor.kind}
              className="flex items-start justify-between gap-4 px-4 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink dark:text-cream-100">
                  {descriptor.title}
                  {descriptor.required ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle dark:text-cream-400">
                      Required
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                  {descriptor.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {rowBusy ? (
                  <Loader2
                    className="h-4 w-4 animate-spin text-ink-muted"
                    strokeWidth={2}
                    aria-label="Saving"
                  />
                ) : null}
                <button
                  type="button"
                  role="switch"
                  aria-checked={granted}
                  aria-busy={rowBusy}
                  disabled={descriptor.required || rowBusy || savingKind !== null}
                  onClick={() => updateConsent(descriptor.kind, !granted)}
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
              </div>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p
          role="alert"
          className="border-t border-cream-200 px-4 py-3 text-sm text-status-danger dark:border-hairline-dark"
        >
          {error}
        </p>
      ) : null}

      <p className="border-t border-cream-200 px-4 py-3 text-[11px] text-ink-muted dark:border-hairline-dark dark:text-cream-400">
        Required consents stay on while your account is active. See our{" "}
        <Link
          href="/legal/privacy"
          className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Privacy Notice
        </Link>
        .
      </p>
    </section>
  );
}
