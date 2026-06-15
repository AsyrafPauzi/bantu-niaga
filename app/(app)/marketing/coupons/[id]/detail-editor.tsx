"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  CouponForm,
  type CouponFormValues,
  type CouponSubmitBody,
} from "@/components/marketing/CouponForm";

type CouponType = "PCT" | "AMT";
type CouponStatus = "active" | "paused" | "expired";

interface CouponEditable {
  id: string;
  code: string;
  name: string | null;
  type: CouponType;
  value: number;
  min_subtotal_myr: number;
  valid_from: string;
  valid_until: string | null;
  total_limit: number | null;
  per_customer_limit: number;
  segment_id: string | null;
  status: CouponStatus;
  redeemed_count: number;
}

/**
 * Convert an ISO timestamp to the "yyyy-MM-ddTHH:mm" shape that
 * <input type="datetime-local"> expects. Drops the seconds + timezone.
 */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function CouponDetailEditor({ coupon }: { coupon: CouponEditable }) {
  const router = useRouter();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initialValues: Partial<CouponFormValues> = {
    code: coupon.code,
    name: coupon.name ?? "",
    type: coupon.type,
    value: String(coupon.value),
    min_subtotal_myr: String(coupon.min_subtotal_myr),
    valid_from: isoToLocalInput(coupon.valid_from),
    valid_until: isoToLocalInput(coupon.valid_until),
    total_limit: coupon.total_limit !== null ? String(coupon.total_limit) : "",
    per_customer_limit: String(coupon.per_customer_limit),
    segment_id: coupon.segment_id ?? "",
    status: coupon.status,
  };

  async function onSubmit(body: CouponSubmitBody) {
    // Code is immutable — strip it before sending.
    const { code: _stripped, ...rest } = body;
    void _stripped;
    const res = await fetch(`/api/marketing/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rest),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data?.message === "string"
          ? data.message
          : typeof data?.error === "string"
            ? data.error
            : `update failed (${res.status})`,
      );
    }
    router.refresh();
  }

  async function onDelete() {
    if (deleting) return;
    if (
      !confirm(
        coupon.redeemed_count > 0
          ? "This coupon has redemptions. Soft-delete will be blocked — pause it instead?"
          : "Soft-delete this coupon? It will be hidden but its redemption log is preserved.",
      )
    ) {
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/marketing/coupons/${coupon.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.reason === "string"
            ? body.reason
            : typeof body?.message === "string"
              ? body.message
              : `delete failed (${res.status})`,
        );
      }
      router.push("/marketing/coupons");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <CouponForm
        initialValues={initialValues}
        codeLocked
        submitLabel="Save changes"
        onSubmit={onSubmit}
      />

      <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Soft-delete coupon</p>
            <p className="mt-0.5 text-xs text-status-danger/80">
              Removes from the list. Pause first if any redemptions exist.
            </p>
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md border border-status-danger/40 bg-white px-3 py-1.5 text-xs font-semibold text-status-danger shadow-card hover:bg-status-danger/10 disabled:opacity-60 dark:bg-panel-dark"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            {deleting ? "Deleting…" : "Soft-delete"}
          </button>
        </div>
        {deleteError ? (
          <p className="mt-2 text-xs">{deleteError}</p>
        ) : null}
      </div>
    </div>
  );
}
