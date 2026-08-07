import Link from "next/link";
import { UserCircle } from "lucide-react";
import { SectionCard } from "@/components/dashboard/section-card";

export function HrStaffPortalPanel({
  linkedCount,
  totalCount,
}: {
  linkedCount: number;
  totalCount: number;
}) {
  const unlinked = Math.max(0, totalCount - linkedCount);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Staff self-service"
        subtitle={
          totalCount === 0
            ? "Add employees first, then link logins"
            : `${linkedCount} of ${totalCount} active staff can sign in at /hr/me`
        }
      >
        <div className="space-y-4 text-sm text-ink dark:text-cream-100">
          <p className="text-ink-muted dark:text-cream-400">
            Staff with a linked login can check leave balance, apply for leave,
            and view their history at{" "}
            <Link href="/hr/me" className="font-semibold text-brand-700 hover:underline dark:text-brand-200">
              /hr/me
            </Link>
            .
          </p>
          {unlinked > 0 ? (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
              {unlinked} staff profile{unlinked === 1 ? "" : "s"} still need a
              team login linked from the employee record.
            </p>
          ) : null}
          <Link
            href="/hr/employees"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <UserCircle className="h-4 w-4" strokeWidth={2} />
            Manage employee logins
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
