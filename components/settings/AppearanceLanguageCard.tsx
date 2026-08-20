"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { apiErrorMessage } from "@/lib/api/client-error";
import { writePreferredLocaleCookie } from "@/lib/i18n/preferred-locale-cookie";
import { cn } from "@/lib/utils/cn";

type EmailLocale = "en" | "ms";

export function AppearanceLanguageCard() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [locale, setLocale] = useState<EmailLocale>("en");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const OPTIONS: readonly {
    value: EmailLocale;
    label: string;
    caption: string;
  }[] = [
    {
      value: "en",
      label: "English",
      caption: t("languageEnCaption"),
    },
    {
      value: "ms",
      label: "Bahasa Melayu",
      caption: t("languageMsCaption"),
    },
  ];

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
      } else {
        writePreferredLocaleCookie(next);
        router.refresh();
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
        <CardTitle>{t("languageTitle")}</CardTitle>
      </CardHeader>
      <CardBody>
        <fieldset disabled={pending}>
          <legend className="sr-only">{tAuth("languageToggle")}</legend>
          <div
            role="radiogroup"
            aria-label={tAuth("languageToggle")}
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
          <p role="alert" className="mt-3 text-sm text-status-danger">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
