import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Ticket } from "lucide-react";
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
import { CouponStatusToggle } from "./status-toggle";

export const metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

interface CouponListRow {
  id: string;
  code: string;
  name: string | null;
  type: "PCT" | "AMT";
  value: number | string;
  min_subtotal_myr: number | string;
  valid_from: string;
  valid_until: string | null;
  total_limit: number | null;
  per_customer_limit: number;
  status: "active" | "paused" | "expired";
  redeemed_count: number;
}

function formatValidWindow(from: string, until: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
  const f = new Date(from).toLocaleDateString("en-MY", opts);
  if (!until) return `From ${f}`;
  const u = new Date(until).toLocaleDateString("en-MY", opts);
  return `${f} → ${u}`;
}

function formatTypeValue(type: "PCT" | "AMT", value: number | string): string {
  const n = Number(value);
  if (type === "PCT") return `${n}% off`;
  return `${formatMyr(n)} off`;
}

export default async function MarketingCouponsPage() {
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("coupons")
    .select(
      "id, code, name, type, value, min_subtotal_myr, valid_from, valid_until, total_limit, per_customer_limit, status, redeemed_count",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as CouponListRow[];

  return (
    <div className="space-y-6">
      <Link
        href="/marketing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Back to Marketing
      </Link>

      <PageHeader
        eyebrow="Marketing"
        title="Coupons"
        description="Percentage- and ringgit-off promo codes. Scope to a segment, watch redemptions in real time."
        action={
          <Link
            href="/marketing/coupons/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            New coupon
          </Link>
        }
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load coupons: {error.message}
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
            <tr>
              <th className="px-5 py-3 text-left">Code</th>
              <th className="px-3 py-3 text-left">Type / value</th>
              <th className="px-3 py-3 text-left">Valid window</th>
              <th className="px-3 py-3 text-right">Redeemed</th>
              <th className="px-5 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  No coupons yet. Create your first promo code to start tracking
                  redemptions.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-panel-light hover:bg-cream-100/60 dark:bg-panel-dark dark:hover:bg-hairline-dark/40"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/marketing/coupons/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200">
                        <Ticket className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-base font-bold uppercase tracking-wider text-ink hover:text-brand-700 dark:text-cream-100">
                          {row.code}
                        </p>
                        {row.name ? (
                          <p className="text-xs text-ink-muted dark:text-cream-400">
                            {row.name}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-ink dark:text-cream-100">
                      {formatTypeValue(row.type, row.value)}
                    </p>
                    {Number(row.min_subtotal_myr) > 0 ? (
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        Min subtotal {formatMyr(Number(row.min_subtotal_myr))}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                    {formatValidWindow(row.valid_from, row.valid_until)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink dark:text-cream-100">
                    {row.redeemed_count.toLocaleString()}
                    <span className="text-ink-muted dark:text-cream-400">
                      {row.total_limit != null
                        ? ` / ${row.total_limit.toLocaleString()}`
                        : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <CouponStatusToggle id={row.id} status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
