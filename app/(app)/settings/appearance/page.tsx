"use client";

import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/theme/theme-provider";
import type { ThemePreference } from "@/lib/theme/types";
import { cn } from "@/lib/utils/cn";

interface ThemeOption {
  value: ThemePreference;
  label: string;
  caption: string;
  icon: LucideIcon;
}

const OPTIONS: readonly ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    caption: "Warm cream surfaces.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    caption: "Low-glare, evening-friendly.",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    caption: "Follow OS appearance.",
    icon: Monitor,
  },
];

export default function AppearanceSettingsPage() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
            Appearance
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-muted dark:text-cream-400">
            Pick a theme for Bantu Niaga. The setting is saved in this browser
            only — we&apos;ll sync it to your account in a later release.
          </p>
        </div>
        <Badge tone="brand">v1 core</Badge>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Theme</CardTitle>
            <span className="text-xs text-ink-muted dark:text-cream-400">
              Currently rendering:{" "}
              <span className="font-medium text-ink dark:text-cream-100">
                {resolved === "dark" ? "Dark" : "Light"}
              </span>
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <fieldset>
            <legend className="sr-only">Theme preference</legend>
            <div
              role="radiogroup"
              aria-label="Theme preference"
              className="grid gap-3 sm:grid-cols-3"
            >
              {OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = preference === option.value;
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
                      name="theme-preference"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPreference(option.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-md",
                          selected
                            ? "bg-brand-500 text-white"
                            : "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-200",
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
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
                    </div>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {option.caption}
                    </p>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="mt-4 text-xs text-ink-muted dark:text-cream-400">
            <span className="font-medium text-ink dark:text-cream-100">
              About &quot;System&quot;:
            </span>{" "}
            Follows your operating system&apos;s appearance setting. Updates
            automatically when you switch.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardBody>
          <div
            className={cn(
              "overflow-hidden rounded-lg border",
              resolved === "dark"
                ? "border-hairline-dark bg-surface-dark"
                : "border-hairline-light bg-surface-light",
            )}
          >
            <div className="grid grid-cols-[120px_1fr]">
              <div
                className={cn(
                  "border-r p-3",
                  resolved === "dark"
                    ? "border-hairline-dark bg-panel-dark"
                    : "border-hairline-light bg-panel-light",
                )}
              >
                <div
                  className={cn(
                    "mb-2 h-2 w-12 rounded-full",
                    resolved === "dark" ? "bg-brand-200/60" : "bg-brand-700/70",
                  )}
                />
                <div className="space-y-1.5">
                  <div
                    className={cn(
                      "h-2 w-16 rounded",
                      resolved === "dark"
                        ? "bg-hairline-dark"
                        : "bg-cream-300",
                    )}
                  />
                  <div
                    className={cn(
                      "h-2 w-20 rounded border-l-2 border-accent-500 pl-1",
                      resolved === "dark"
                        ? "bg-brand-900/40"
                        : "bg-brand-50",
                    )}
                  />
                  <div
                    className={cn(
                      "h-2 w-14 rounded",
                      resolved === "dark"
                        ? "bg-hairline-dark"
                        : "bg-cream-300",
                    )}
                  />
                </div>
              </div>
              <div className="p-4">
                <div
                  className={cn(
                    "mb-3 h-3 w-32 rounded",
                    resolved === "dark" ? "bg-cream-100/60" : "bg-ink/80",
                  )}
                />
                <div
                  className={cn(
                    "h-16 rounded-lg border",
                    resolved === "dark"
                      ? "border-hairline-dark bg-panel-dark"
                      : "border-hairline-light bg-panel-light",
                  )}
                />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
