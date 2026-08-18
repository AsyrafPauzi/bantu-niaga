"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { apiErrorMessage } from "@/lib/api/client-error";
import { cn } from "@/lib/utils/cn";

type EmailLocale = "en" | "ms";

const OPTIONS: readonly { value: EmailLocale; label: string; caption: string }[] =
  [
    {
      value: "en",
      label: "English",
      caption: "Emails and this preference default to English.",
    },
    {
      value: "ms",
      label: "Bahasa Melayu",
      caption: "Auth and product emails use Bahasa Melayu.",
    },
  ];

export function AppearanceLanguageCard() {
  const [locale, setLocale] = useState<EmailLocale>("en");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/profile", {
          method: "GET",
          credentials: "same-origin",
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          if (!cancelled) {
            setError(apiErrorMessage(json, "Could not load language."));
          }
          return;
        }
        const profile = (json as { profile?: { preferred_locale?: string } })
          .profile;
        const next = profile?.preferred_locale === "ms" ? "ms" : "en";
        if (!cancelled) setLocale(next);
      } catch {
        if (!cancelled) setError("Could not load language.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(next: EmailLocale) {
    setPending(true);
    setError(null);
    const previous = locale;
    setLocale(next);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred_locale: next }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setLocale(previous);
        setError(apiErrorMessage(json, "Could not save language."));
      }
    } catch {
      setLocale(previous);
      setError("Could not save language.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language</CardTitle>
      </CardHeader>
      <CardBody>
        <fieldset disabled={pending}>
          <legend className="sr-only">Email language</legend>
          <div
            role="radiogroup"
            aria-label="Email language"
            className="grid gap-3 sm:grid-cols-2"
          >
            {OPTIONS.map((option) => {
              const selected = locale === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors",
                    "focus-within:ring-2 focus-within:ring-brand-400",
                    selected
                      ? "border-accent-500 bg-brand-50 dark:bg-brand-900/30"
                      : "border-hairline-light bg-panel-light hover:border-brand-200 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-700",
                  )}
                >
                  <input
                    type="radio"
                    name="preferred-locale"
                    value={option.value}
                    checked={selected}
                    onChange={() => void choose(option.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      selected
                        ? "text-brand-700 dark:text-brand-200"
                        : "text-ink dark:text-cream-100",
                    )}
                  >
                    {option.label}
                  </span>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {option.caption}
                  </p>
                </label>
              );
            })}
          </div>
        </fieldset>
        {error ? (
          <p
            role="alert"
            className="mt-3 text-sm text-status-danger"
          >
            {error}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-ink-muted dark:text-cream-400">
          Saved on your account. Theme above stays on this browser only.
        </p>
      </CardBody>
    </Card>
  );
}
