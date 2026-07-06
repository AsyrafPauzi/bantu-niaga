import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { HrEmployeeCreateForm } from "@/components/hr/HrEmployeeCreateForm";
import { HrBackLink } from "@/components/hr/layout/hr-back-link";
import { HrFormColumns } from "@/components/hr/layout/hr-form-columns";
import { HrInfoBanner } from "@/components/hr/layout/hr-info-banner";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";

export const metadata = { title: "Add employee" };
export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
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
          You do not have access to add employees.
        </CardBody>
      </Card>
    );
  }

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Add employee"
          subtitle="Fill in the details below. You can update them later."
          helpHref="/more"
        />
      }
    >
      <HrPageBody className="gap-5">
        <HrMobileSubnav />
        <HrBackLink href="/hr/employees" label="Back to Employees" />

        <HrInfoBanner
          title="New employee setup"
          description="Fill in each section below. You can upload documents during onboarding — no separate upload page needed."
        />

        <HrFormColumns
          form={
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 dark:border-hairline-dark dark:bg-panel-dark">
              <HrEmployeeCreateForm
                hideSubmit
                redirectTo="/hr/employees"
              />
            </div>
          }
          help={
            <HrInfoBanner
              title="What happens next?"
              description="After saving, you can share a leave form link, upload IC and bank documents, and track onboarding from the employee profile."
            />
          }
        />

        <div className="flex justify-end gap-3 border-t border-[#E5E0D8] pt-4 dark:border-hairline-dark">
          <Link
            href="/hr/employees"
            className="inline-flex items-center justify-center rounded-[10px] border border-[#E5E0D8] px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="hr-employee-create"
            className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Add employee
          </button>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
