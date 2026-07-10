import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMyr } from "@/lib/marketing/metrics";
import { CouponStatusBadge } from "@/components/marketing/CouponStatusBadge";
import { CouponDetailEditor } from "./detail-editor";
import { CouponShareLink } from "./share-link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Coupon ${id.slice(0, 8)}` };
}

interface CouponRow {
  id: string;
  business_id: string;
  code: string;
  name: string | null;
  type: "PCT" | "AMT";
  value: number | string;
  min_subtotal_myr: number | string;
  valid_from: string;
  valid_until: string | null;
  total_limit: number | null;
  per_customer_limit: number;
  segment_id: string | null;
  status: "active" | "paused" | "expired";
  redeemed_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface RedemptionRow {
  id: string;
  coupon_id: string;
  customer_id: string | null;
  order_ref: string | null;
  discount_amount_myr: number | string;
  redeemed_at: string;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

export default async function CouponDetailPage({ params }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }
  if (!canSurface(user.role, "marketing", "coupons")) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Marketing coupons.
          </p>
        </CardBody>
      </Card>
    );
  }

  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: rawCoupon } = await supabase
    .from("coupons")
    .select(
      "id, business_id, code, name, type, value, min_subtotal_myr, valid_from, valid_until, total_limit, per_customer_limit, segment_id, status, redeemed_count, created_at, updated_at, deleted_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!rawCoupon) notFound();
  const coupon = rawCoupon as CouponRow;

  const { data: rawRedemptions } = await supabase
    .from("coupon_redemptions")
    .select(
      "id, coupon_id, customer_id, order_ref, discount_amount_myr, redeemed_at",
    )
    .eq("coupon_id", id)
    .order("redeemed_at", { ascending: false })
    .limit(50);
  const redemptions = (rawRedemptions ?? []) as RedemptionRow[];

  const customerIds = Array.from(
    new Set(redemptions.map((r) => r.customer_id).filter((v): v is string => Boolean(v))),
  );
  let customers: { id: string; name: string }[] = [];
  if (customerIds.length > 0) {
    const { data: custData } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", customerIds);
    customers = (custData ?? []) as { id: string; name: string }[];
  }
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const valueNum = Number(coupon.value);
  const minSubtotalNum = Number(coupon.min_subtotal_myr);

  return (
    <div className="space-y-6">
      <Link
        href="/marketing/coupons"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to Coupons
      </Link>

      <PageHeader
        eyebrow="Marketing · Coupons"
        title={coupon.code}
        description={
          coupon.name ??
          (coupon.type === "PCT"
            ? `${valueNum}% off${minSubtotalNum > 0 ? ` (min ${formatMyr(minSubtotalNum)})` : ""}`
            : `${formatMyr(valueNum)} off${minSubtotalNum > 0 ? ` (min ${formatMyr(minSubtotalNum)})` : ""}`)
        }
        action={
          <div className="flex items-center gap-2">
            <CouponShareLink
              code={coupon.code}
              discountLabel={
                coupon.type === "PCT"
                  ? `${valueNum}% off`
                  : `${formatMyr(valueNum)} off`
              }
            />
            <CouponStatusBadge status={coupon.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Edit coupon
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Code is immutable. Edit value, dates, limits, status, or scope below.
              </p>
            </div>
            <CouponDetailEditor
              coupon={{
                id: coupon.id,
                code: coupon.code,
                name: coupon.name,
                type: coupon.type,
                value: valueNum,
                min_subtotal_myr: minSubtotalNum,
                valid_from: coupon.valid_from,
                valid_until: coupon.valid_until,
                total_limit: coupon.total_limit,
                per_customer_limit: coupon.per_customer_limit,
                segment_id: coupon.segment_id,
                status: coupon.status,
                redeemed_count: coupon.redeemed_count,
              }}
            />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-3 dark:border-hairline-dark">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Redemption log
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {coupon.redeemed_count.toLocaleString()} total redemption
                {coupon.redeemed_count === 1 ? "" : "s"}
                {coupon.total_limit != null
                  ? ` of ${coupon.total_limit.toLocaleString()}`
                  : ""}
              </p>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
              <tr>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-right">Discount</th>
                <th className="px-5 py-3 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {redemptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                  >
                    No redemptions yet.
                  </td>
                </tr>
              ) : (
                redemptions.map((r) => (
                  <tr
                    key={r.id}
                    className="bg-panel-light dark:bg-panel-dark"
                  >
                    <td className="px-5 py-3">
                      {r.customer_id ? (
                        <Link
                          href={`/marketing/customers/${r.customer_id}`}
                          className="text-sm font-semibold text-ink hover:text-brand-700 dark:text-cream-100"
                        >
                          {nameById.get(r.customer_id) ?? "Unknown customer"}
                        </Link>
                      ) : (
                        <span className="text-sm text-ink-muted dark:text-cream-400">
                          Walk-in
                        </span>
                      )}
                      {r.order_ref ? (
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          Order ref:{" "}
                          <code className="font-mono">{r.order_ref}</code>
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(Number(r.discount_amount_myr))}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-muted dark:text-cream-400">
                      {relativeTime(r.redeemed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
