import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrLeaveRecordRow } from "@/components/hr/HrLeaveRecordRow";
import { HrBackLink } from "@/components/hr/layout/hr-back-link";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrLeaveRecords } from "@/lib/hr/load";

export const metadata = { title: "Leave history" };
export const dynamic = "force-dynamic";

export default async function LeaveHistoryPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
          You do not have access to leave records.
        </CardBody>
      </Card>
    );
  }

  const leave = await loadHrLeaveRecords(user.businessId);

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Leave history"
          subtitle="All leave records — pending, approved, and rejected"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />
        <HrBackLink href="/hr/leave" label="Back to Leave" />

        <SectionCard
          title="All leave records"
          subtitle={`${leave.length} record${leave.length === 1 ? "" : "s"} on file`}
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
        >
          {leave.length === 0 ? (
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No leave records yet.{" "}
              <Link href="/hr/leave/record" className="font-semibold text-brand-700">
                Record leave
              </Link>
            </p>
          ) : (
            leave.map((row) => (
              <HrLeaveRecordRow key={row.id} row={row} showStatus />
            ))
          )}
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
