import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingCouponsBackLink } from "@/components/marketing/MarketingCouponsBackLink";
import { CouponDetailView } from "@/components/marketing/CouponDetailView";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
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

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { title: "Coupon" };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("coupons")
    .select("code")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return { title: data?.code ?? "Coupon" };
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
    new Set(
      redemptions.map((r) => r.customer_id).filter((v): v is string => Boolean(v)),
    ),
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

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingCouponsBackLink />
      <CouponDetailView
        coupon={{
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          type: coupon.type,
          value: Number(coupon.value),
          min_subtotal_myr: Number(coupon.min_subtotal_myr),
          valid_from: coupon.valid_from,
          valid_until: coupon.valid_until,
          total_limit: coupon.total_limit,
          per_customer_limit: coupon.per_customer_limit,
          segment_id: coupon.segment_id,
          status: coupon.status,
          redeemed_count: coupon.redeemed_count,
        }}
        redemptions={redemptions.map((r) => ({
          id: r.id,
          customer_id: r.customer_id,
          order_ref: r.order_ref,
          discount_amount_myr: Number(r.discount_amount_myr),
          redeemed_at: r.redeemed_at,
          customer_name: r.customer_id
            ? nameById.get(r.customer_id)
            : undefined,
        }))}
      />
    </div>
  );
}
