"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CouponStatusBadge } from "@/components/marketing/CouponStatusBadge";

type CouponStatus = "active" | "paused" | "expired";

/**
 * Inline status toggle. Click cycles active ↔ paused (we never let
 * the operator manually flip to "expired" — that's automated by the
 * backfill / nightly cron). For coupons already at status='expired'
 * we render a static badge.
 */
export function CouponStatusToggle({
  id,
  status: initialStatus,
}: {
  id: string;
  status: CouponStatus;
}) {
  const [status, setStatus] = useState<CouponStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (status === "expired") {
    return <CouponStatusBadge status="expired" />;
  }

  const next: CouponStatus = status === "active" ? "paused" : "active";

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/marketing/coupons/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof body?.message === "string"
              ? body.message
              : `update failed (${res.status})`,
          );
        }
        setStatus(next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "update failed");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={
        error
          ? `Failed: ${error}`
          : `Click to set status to ${next}`
      }
      className="inline-flex items-center gap-1.5 rounded-full hover:opacity-80 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.25} />
      ) : null}
      <CouponStatusBadge status={status} />
    </button>
  );
}
