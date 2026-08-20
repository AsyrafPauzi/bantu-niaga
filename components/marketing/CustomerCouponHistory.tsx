import { formatMyr } from "@/lib/marketing/metrics";
import type { CustomerCouponRedemption } from "@/lib/marketing/coupon-redemptions-load";

export function CustomerCouponHistory({
  redemptions,
}: {
  redemptions: CustomerCouponRedemption[];
}) {
  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
      <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
        Coupons redeemed
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
        Codes applied at POS or checkout for this customer
      </p>
      {redemptions.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted dark:text-cream-500">
          No coupons yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-cream-100 dark:divide-hairline-dark">
          {redemptions.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold tabular-nums text-ink dark:text-cream-100">
                  {r.code}
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-500">
                  {new Date(r.redeemed_at).toLocaleString("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-[#0D9488] dark:text-teal-300">
                −{formatMyr(r.discount_amount_myr)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
