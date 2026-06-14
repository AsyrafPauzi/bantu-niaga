"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

/**
 * Reads `?meta=connected|error&detail=…` query params left behind by the
 * OAuth callback and surfaces a toast. Clears the params after rendering
 * so a refresh doesn't re-trigger the toast.
 */

const ERROR_MAP: Record<string, string> = {
  not_configured:
    "Meta is not configured on this server. Add META_APP_ID and META_APP_SECRET to .env.",
  forbidden: "You don't have permission to connect social accounts.",
  session_expired: "Your session expired during the connection. Try again.",
  invalid_state:
    "Security check failed (state mismatch). Please start the connect flow again.",
  missing_code_or_state:
    "Meta returned an incomplete response. Try connecting again.",
  no_pages_found:
    "Your Facebook account has no Pages. Create a Page on Facebook first, then retry.",
  user_denied:
    "You declined the permission request. We need it to publish on your behalf.",
  network_error: "Couldn't reach Meta's servers. Check your connection and retry.",
};

export function CallbackToast() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  const meta = search.get("meta");
  const detail = search.get("detail");

  useEffect(() => {
    if (!meta) return;
    const t = setTimeout(() => clearParams(), 7000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  function clearParams() {
    setHidden(true);
    const next = new URLSearchParams(Array.from(search.entries()));
    next.delete("meta");
    next.delete("detail");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  if (!meta || hidden) return null;

  const success = meta === "connected";

  let title: string;
  let body: string;
  if (success) {
    const m = detail?.match(/^(\d+)fb_(\d+)ig$/);
    const fb = m ? Number(m[1]) : 0;
    const ig = m ? Number(m[2]) : 0;
    title = "Meta connected";
    body =
      fb || ig
        ? `Linked ${fb} Facebook Page${fb === 1 ? "" : "s"}${
            ig > 0
              ? ` and ${ig} Instagram Business account${ig === 1 ? "" : "s"}`
              : ""
          }. You can now post from Marketing.`
        : "Connection completed.";
  } else {
    title = "Couldn't finish connecting";
    body = ERROR_MAP[detail ?? ""] ?? `Meta returned: ${detail ?? "unknown"}`;
  }

  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${
        success
          ? "border-status-success/30 bg-status-success/10"
          : "border-status-danger/30 bg-status-danger/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {success ? (
          <CheckCircle2
            className="h-5 w-5 shrink-0 text-status-success"
            strokeWidth={2}
          />
        ) : (
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-status-danger"
            strokeWidth={2}
          />
        )}
        <div>
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {body}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={clearParams}
        className="rounded-md p-1 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/60"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
