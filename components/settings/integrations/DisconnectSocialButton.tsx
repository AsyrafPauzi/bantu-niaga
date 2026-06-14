"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Unlink } from "lucide-react";

interface DisconnectSocialButtonProps {
  accountId: string;
  accountName: string;
  cascadeProvider?: "self" | "both";
}

export function DisconnectSocialButton({
  accountId,
  accountName,
  cascadeProvider = "self",
}: DisconnectSocialButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const verb =
      cascadeProvider === "both"
        ? `Disconnect ${accountName} and all linked Instagram accounts?`
        : `Disconnect ${accountName}?`;
    if (!window.confirm(verb)) return;

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/social/meta/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, cascadeProvider }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          setError(body?.message ?? body?.error ?? `HTTP ${res.status}`);
          return;
        }
        router.refresh();
      } catch (e) {
        setError((e as Error).message ?? "Network error");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-status-danger/30 bg-white px-3 py-1.5 text-xs font-semibold text-status-danger shadow-card hover:bg-status-danger/10 disabled:opacity-50 dark:border-status-danger/40 dark:bg-panel-dark"
      >
        <Unlink className="h-3 w-3" strokeWidth={2} />
        {pending ? "Disconnecting…" : "Disconnect"}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-md bg-[#F8DDD9] px-3 py-1 text-xs text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]"
        >
          {error}
        </p>
      )}
    </>
  );
}
