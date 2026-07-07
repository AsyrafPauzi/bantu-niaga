import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrAppraisalCreateForm } from "@/components/hr/HrAppraisalCreateForm";
import { HrAppraisalList } from "@/components/hr/HrAppraisalList";
import { HrStaffAppraisalGate } from "@/components/hr/HrStaffAppraisalGate";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { appraisalDisplayStatus } from "@/lib/hr/appraisal";
import { loadHrEmployees, loadHrStaffAppraisals } from "@/lib/hr/load";
import { hasStaffAppraisalAddon } from "@/lib/marketplace/entitlements";

export const metadata = { title: "Staff appraisals" };
export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function HrAppraisalsPage() {
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
          You do not have access to staff appraisals.
        </CardBody>
      </Card>
    );
  }

  const [addonActive, employees, appraisals] = await Promise.all([
    hasStaffAppraisalAddon(user.businessId),
    loadHrEmployees(user.businessId),
    loadHrStaffAppraisals(user.businessId),
  ]);

  if (!addonActive) {
    return (
      <HrPageShell
        header={
          <HrPageHeader
            title="Staff appraisals"
            subtitle="Track performance reviews and due dates"
            helpHref="/more"
          />
        }
      >
        <HrPageBody>
          <HrMobileSubnav />
          <HrStaffAppraisalGate />
        </HrPageBody>
      </HrPageShell>
    );
  }

  const today = todayIso();
  const pending = appraisals.filter((row) => row.status !== "completed");
  const overdue = pending.filter(
    (row) => appraisalDisplayStatus(row, today) === "overdue",
  );

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Staff appraisals"
          subtitle="See who needs a review and mark appraisals complete"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard
            title="Appraisal checker"
            subtitle={
              appraisals.length === 0
                ? "No reviews scheduled yet"
                : `${appraisals.length - pending.length} of ${appraisals.length} complete` +
                  (overdue.length > 0 ? ` · ${overdue.length} overdue` : "")
            }
          >
            <HrAppraisalList items={appraisals} todayIso={today} />
          </SectionCard>

          <SectionCard
            title="Schedule appraisal"
            subtitle="Annual, quarterly, or probation reviews"
          >
            <HrAppraisalCreateForm employees={employees} />
          </SectionCard>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
