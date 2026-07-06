"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Users, Zap } from "lucide-react";

interface HrAgentSettingsCardProps {
  className?: string;
}

interface HrSettingsResponse {
  settings: {
    display_name: string;
    assistant_enabled: boolean;
    daily_notice_enabled: boolean;
  };
  addon_active: boolean;
  credit_balance: number;
}

export function HrAgentSettingsCard({ className }: HrAgentSettingsCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<HrSettingsResponse | null>(null);
  const [displayName, setDisplayName] = useState("Hana");
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const [dailyNoticeEnabled, setDailyNoticeEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/ai-agents/hr");
      const json = (await res.json()) as HrSettingsResponse;
      if (res.ok) {
        setData(json);
        setDisplayName(json.settings.display_name);
        setAssistantEnabled(json.settings.assistant_enabled);
        setDailyNoticeEnabled(json.settings.daily_notice_enabled);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/ai-agents/hr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          assistant_enabled: assistantEnabled,
          daily_notice_enabled: dailyNoticeEnabled,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(json?.message ?? "Could not save settings.");
        return;
      }
      setMessage("Saved.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-ink-muted dark:text-cream-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading HR Assistant settings…
        </div>
      </div>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-cream-300 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Users className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink dark:text-cream-100">
            HR Assistant (Hana)
          </h2>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            Name your HR helper, turn chat on or off, and control the daily HR
            notice on Home.
          </p>
        </div>
        {data?.addon_active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Zap className="h-3 w-3" />
            {data.credit_balance} credits
          </span>
        ) : (
          <Link
            href="/marketplace"
            className="text-xs font-semibold text-brand-700 dark:text-brand-200"
          >
            Get add-on →
          </Link>
        )}
      </div>

      {!data?.addon_active ? (
        <p className="mt-4 text-sm text-ink-muted dark:text-cream-400">
          Subscribe to <strong>HR Assistant (Hana)</strong> in the Marketplace
          (RM 20/month, 100 credits) to enable chat and daily notices.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-ink dark:text-cream-100">
              Assistant name
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className="mt-1.5 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-surface-dark dark:text-cream-100"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-cream-400">
            <input
              type="checkbox"
              checked={assistantEnabled}
              onChange={(e) => setAssistantEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-cream-300"
            />
            HR chat enabled
          </label>

          <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-cream-400">
            <input
              type="checkbox"
              checked={dailyNoticeEnabled}
              onChange={(e) => setDailyNoticeEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-cream-300"
            />
            Show daily HR notice on Home &amp; HR page
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <Link
              href="/settings/billing"
              className="text-sm font-medium text-brand-700 dark:text-brand-200"
            >
              Top up credits
            </Link>
            <Link
              href="/hr/assistant"
              className="text-sm font-medium text-ink-muted dark:text-cream-400"
            >
              Open chat →
            </Link>
          </div>

          {message ? (
            <p className="text-xs text-ink-muted dark:text-cream-400">{message}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
