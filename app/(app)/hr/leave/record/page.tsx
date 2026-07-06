import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrLeaveCreateForm } from "@/components/hr/HrLeaveCreateForm";
import { HrBackLink } from "@/components/hr/layout/hr-back-link";
import { HrFormColumns } from "@/components/hr/layout/hr-form-columns";
import { HrInfoBanner } from "@/components/hr/layout/hr-info-banner";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees } from "@/lib/hr/load";

export const metadata = { title: "Record leave" };
export const dynamic = "force-dynamic";

export default async function RecordLeavePage() {
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
          You do not have access to record leave.
        </CardBody>
      </Card>
    );
  }

  const employees = await loadHrEmployees(user.businessId);

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Record leave"
          subtitle="Add a leave record for someone on your team"
          helpHref="/more"
          action={
            <button
              type="submit"
              form="hr-leave-create"
              className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Record leave
            </button>
          }
        />
      }
    >
      <HrPageBody className="gap-5">
        <HrMobileSubnav />
        <HrBackLink href="/hr/leave" label="Back to Leave" />

        <HrFormColumns
          form={
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 dark:border-hairline-dark dark:bg-panel-dark">
              <HrLeaveCreateForm
                employees={employees}
                hideSubmit
                redirectTo="/hr/leave"
              />
            </div>
          }
          help={
            <HrInfoBanner
              title="Manager entry"
              description="Use this when you are recording leave on behalf of staff. For staff self-service, share a private leave form from the Employees page."
            />
          }
        />

        <div className="flex justify-end gap-3 lg:hidden">
          <Link
            href="/hr/leave"
            className="inline-flex items-center justify-center rounded-[10px] border border-[#E5E0D8] px-4 py-2.5 text-[13px] font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="hr-leave-create"
            className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            Record leave
          </button>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
