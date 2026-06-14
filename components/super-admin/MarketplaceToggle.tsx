"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type MarketplaceStatus = "live" | "draft" | "disabled";

export function MarketplaceToggle({
  addonId,
  initialStatus,
}: {
  addonId: string;
  initialStatus: MarketplaceStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<MarketplaceStatus>(initialStatus);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: MarketplaceStatus = status === "live" ? "disabled" : "live";
    const previous = status;
    setStatus(next);
    startTransition(async () => {
      const res = await fetch(`/api/super-admin/marketplace/${addonId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setStatus(previous);
        return;
      }
      router.refresh();
    });
  }

  const on = status === "live";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? "Disable add-on" : "Publish add-on live"}
      className={cn(
        "inline-flex h-6 w-10 items-center rounded-full p-0.5 transition-colors",
        on ? "bg-status-success justify-end" : "bg-cream-300 justify-start",
        pending && "opacity-60 cursor-wait",
      )}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}
