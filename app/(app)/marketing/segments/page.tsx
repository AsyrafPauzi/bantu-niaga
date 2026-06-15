import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Segments" };

export default function MarketingSegmentsPage() {
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
        title="Segments"
        description="A unified workspace for VIP, Repeat, New, At-risk, and Dormant cohorts — coming soon."
      />

      <div className="rounded-xl border border-cream-200 bg-white p-8 text-center shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Users className="h-6 w-6" strokeWidth={2} />
        </span>
        <Badge tone="neutral" className="mb-3">Coming soon</Badge>
        <h2 className="text-lg font-semibold text-ink dark:text-cream-100">
          Segment workspace
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted dark:text-cream-400">
          Browse every auto-tagged cohort, save custom filters, and launch
          targeted broadcasts. For now, segments are filterable directly from
          the Customers list.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/marketing/customers"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-600 active:bg-accent-700"
          >
            Open Customers list
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
