"use client";

import { useState } from "react";
import {
  costHintForMode,
  type NadiaSettings,
} from "@/lib/super-admin/nadia-settings";
import {
  NADIA_REPLY_MODE_LABELS,
  type NadiaReplyMode,
} from "@/lib/super-admin/platform-agents-catalog";
import { cn } from "@/lib/utils/cn";

const MODES: NadiaReplyMode[] = [
  "text_and_voice",
  "text_only",
  "voice_only",
];

export function NadiaReplySettings({
  initialSettings,
}: {
  initialSettings: NadiaSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: NadiaSettings) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/super-admin/agents/nadia/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      setSettings(data.settings);
      setMessage("Saved");
    } catch {
      setMessage("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream-300 bg-white p-4 shadow-card">
      <p className="text-sm font-semibold text-ink">Reply channels</p>
      <p className="mt-1 text-xs text-ink-muted">
        Control how Nadia responds on the Revenue dashboard. Enforced
        server-side.
      </p>

      <div className="mt-4 space-y-2">
        {MODES.map((mode) => (
          <label
            key={mode}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
              settings.reply_mode === mode
                ? "border-brand-500 bg-brand-50"
                : "border-cream-300 hover:bg-cream-50",
            )}
          >
            <input
              type="radio"
              name="reply_mode"
              checked={settings.reply_mode === mode}
              disabled={saving}
              onChange={() => void save({ ...settings, reply_mode: mode })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                {NADIA_REPLY_MODE_LABELS[mode]}
              </span>
              <span className="block text-[11px] text-ink-muted">
                {costHintForMode(mode)}
              </span>
            </span>
          </label>
        ))}
      </div>

      {(settings.reply_mode === "text_and_voice" ||
        settings.reply_mode === "voice_only") && (
        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={settings.voice_auto_play ?? true}
            disabled={saving}
            onChange={(e) =>
              void save({
                ...settings,
                voice_auto_play: e.target.checked,
              })
            }
          />
          Auto-play voice responses
        </label>
      )}

      {message ? (
        <p className="mt-3 text-xs font-medium text-brand-700">{message}</p>
      ) : null}
    </div>
  );
}
