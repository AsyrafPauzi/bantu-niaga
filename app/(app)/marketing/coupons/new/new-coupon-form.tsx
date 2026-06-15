"use client";

import { useRouter } from "next/navigation";
import { CouponForm, type CouponSubmitBody } from "@/components/marketing/CouponForm";

export function NewCouponForm() {
  const router = useRouter();

  async function onSubmit(body: CouponSubmitBody) {
    const res = await fetch("/api/marketing/coupons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data?.message === "string"
          ? data.message
          : typeof data?.error === "string"
            ? data.error
            : `create failed (${res.status})`,
      );
    }
    const newId = data?.data?.id;
    router.push(
      typeof newId === "string"
        ? `/marketing/coupons/${newId}`
        : "/marketing/coupons",
    );
    router.refresh();
  }

  return (
    <CouponForm
      submitLabel="Create coupon"
      onSubmit={onSubmit}
      onCancel={() => router.push("/marketing/coupons")}
    />
  );
}
