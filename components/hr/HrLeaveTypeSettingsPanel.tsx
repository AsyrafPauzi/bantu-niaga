"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { HrToast } from "@/components/hr/HrToast";
import type { HrLeaveTypeSettingRow } from "@/lib/hr/leave-type-settings";
import { LEAVE_TYPES, leaveTypeLabel } from "@/lib/hr/leave-labels";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export function HrLeaveTypeSettingsPanel({
  initialSettings,
}: {
  initialSettings: HrLeaveTypeSettingRow[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(
    null,
  );

  function updateRow(
    leaveType: HrLeaveTypeSettingRow["leave_type"],
    patch: Partial<HrLeaveTypeSettingRow>,
  ) {
    setSettings((prev) =>
      prev.map((row) =>
        row.leave_type === leaveType ? { ...row, ...patch } : row,
      ),
    );
  }

  async function save() {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/hr/leave-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message ?? json?.error ?? "Could not save settings.");
      }
      setSettings(json.data ?? settings);
      setToast({ kind: "ok", message: "Leave policy saved." });
    } catch (e) {
      setToast({
        kind: "err",
        message: e instanceof Error ? e.message : "Could not save settings.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
          Global leave quotas & attachments
        </h2>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          Default days per year for each leave type. Employees can override these on
          their profile. Leave blank for no quota (e.g. unpaid).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-cream-200 dark:border-hairline-dark">
        <table className="min-w-full text-sm">
          <thead className="border-b border-cream-200 bg-cream-50 text-left text-xs uppercase text-ink-muted dark:border-hairline-dark dark:bg-panel-dark/60">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Default quota (days)</th>
              <th className="px-3 py-2">Attachment</th>
              <th className="px-3 py-2">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((row) => {
              const meta = LEAVE_TYPES.find((t) => t.key === row.leave_type);
              return (
                <tr
                  key={row.leave_type}
                  className="border-b border-cream-100 dark:border-hairline-dark"
                >
                  <td className="px-3 py-2 font-medium">
                    {meta?.label ?? leaveTypeLabel(row.leave_type)}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={365}
                      step={0.5}
                      value={row.default_quota_days ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        updateRow(row.leave_type, {
                          default_quota_days:
                            v === "" ? null : Number(v),
                        });
                      }}
                      className={cn(hrClasses.input, "max-w-[6rem]")}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.attachment_required}
                      onChange={(e) =>
                        updateRow(row.leave_type, {
                          attachment_required: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-cream-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        updateRow(row.leave_type, { enabled: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-cream-300"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save policy
      </button>

      {toast ? (
        <HrToast
          message={toast.message}
          kind={toast.kind}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
