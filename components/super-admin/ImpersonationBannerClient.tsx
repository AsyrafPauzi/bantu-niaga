"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, LogOut, ShieldAlert } from "lucide-react";

export function ImpersonationBannerClient({
  adminEmail,
  targetName,
  targetEmail,
  businessName,
  expiresAt,
}: {
  adminEmail: string;
  targetName: string;
  targetEmail: string | null;
  businessName: string | null;
  expiresAt: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const minsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 60000));

  function stop() {
    startTransition(async () => {
      await fetch("/api/super-admin/impersonate", { method: "DELETE" });
      router.push("/super-admin/users");
      router.refresh();
    });
  }

  return (
    <div className="sticky top-0 z-50 border-b border-status-warning/40 bg-status-warning/15 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-status-warning text-white">
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 leading-tight">
            <span className="font-bold text-status-warning">Impersonating</span>
            <span className="font-semibold text-ink">{targetName}</span>
            {targetEmail && (
              <span className="text-ink-muted">({targetEmail})</span>
            )}
            {businessName && (
              <span className="text-ink-muted">· {businessName}</span>
            )}
            <span className="text-ink-muted">
              · admin {adminEmail} · {minsLeft}m left · read-only
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            <Eye className="h-3 w-3" />
            View
          </span>
          <button
            type="button"
            onClick={stop}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-[11px] font-bold text-white hover:bg-ink-muted disabled:opacity-60"
          >
            <LogOut className="h-3 w-3" />
            {pending ? "Stopping…" : "Stop impersonating"}
          </button>
        </div>
      </div>
    </div>
  );
}
