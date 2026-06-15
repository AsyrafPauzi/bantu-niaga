import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Coupons" };

export default function MarketingCouponsPage() {
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
        description="Percentage and ringgit-off promo codes for your storefront — coming soon."
      />

      <div className="rounded-xl border border-cream-200 bg-white p-8 text-center shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
          <Gift className="h-6 w-6" strokeWidth={2} />
        </span>
        <Badge tone="neutral" className="mb-3">Coming soon</Badge>
        <h2 className="text-lg font-semibold text-ink dark:text-cream-100">
          Coupon manager
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted dark:text-cream-400">
          Create and track percentage- or ringgit-off coupons, scope them to
          segments, and watch redemptions in real time. We&apos;re building this
          alongside the broadcast tooling.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/marketing/content/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
          >
            Plan a launch post
          </Link>
          <Link
            href="/marketing"
            className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
          >
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
