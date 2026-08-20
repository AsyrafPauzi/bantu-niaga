import { redirect } from "next/navigation";
import { Gift, Ticket } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { MarketingCouponsBackLink } from "@/components/marketing/MarketingCouponsBackLink";
import { NewCouponForm } from "./new-coupon-form";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { newCouponSubpageHero } from "@/lib/marketing/subpage-hero";

export const metadata = { title: "New coupon" };
export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
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
  const { data: couponRows } = await supabase
    .from("coupons")
    .select("status, redeemed_count")
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  const rows = couponRows ?? [];
  const activeCount = rows.filter((r) => r.status === "active").length;
  const redeemedTotal = rows.reduce((n, r) => n + (r.redeemed_count ?? 0), 0);
  const hero = newCouponSubpageHero({ activeCount, redeemedTotal });

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <MarketingCouponsBackLink />

      <ModuleDashboardHero
        module="Marketing · Coupons"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
      >
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <ModuleHeroStat
            label="Active"
            value={activeCount}
            icon={<Ticket />}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Redemptions"
            value={redeemedTotal}
            icon={<Gift />}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Total codes"
            value={rows.length}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-cream-200 bg-panel-light shadow-card dark:border-hairline-dark dark:bg-panel-dark lg:col-span-2">
          <div className="border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Coupon details
            </h2>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Percentage or ringgit off. Leave the code blank to auto-generate
              one.
            </p>
          </div>
          <div className="p-5">
            <NewCouponForm />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-card dark:border-violet-900/40 dark:from-violet-950/30 dark:via-panel-dark dark:to-fuchsia-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              How coupons work
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-ink dark:text-cream-100">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Share via WhatsApp or copy the /c/CODE link — customers redeem
                  at Sales POS.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Set a min subtotal, total redemption cap, or per-customer
                  limit to control spend.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>
                  Attach to a broadcast with{" "}
                  <code className="rounded bg-violet-100 px-1 text-xs dark:bg-violet-900/50">
                    {"{{coupon}}"}
                  </code>{" "}
                  in the message template.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-cream-200 bg-panel-light p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Discount types
            </p>
            <div className="mt-3 space-y-2 text-sm text-ink dark:text-cream-100">
              <p>
                <strong>Percentage</strong> — e.g. 10% off orders above RM 50
              </p>
              <p>
                <strong>Fixed amount</strong> — e.g. RM 5 off any cart
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
