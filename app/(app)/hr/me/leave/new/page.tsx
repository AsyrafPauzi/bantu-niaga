import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import { MeLeaveRequestForm } from "@/components/hr/me/MeLeaveRequestForm";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";

export const metadata = { title: "Apply leave" };
export const dynamic = "force-dynamic";

export default async function HrMeLeaveNewPage() {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const { employee } = ctx;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Apply for leave"
          subtitle="Submit annual, emergency, or MC leave for manager approval"
          action={
            <Link
              href="/hr/me"
              className="inline-flex rounded-[10px] border border-[#E5E0D8] bg-[#FAF7F2] px-3.5 py-2.5 text-[13px] font-semibold text-[#11328A] dark:border-hairline-dark dark:bg-panel-dark dark:text-brand-200"
            >
              ← Back
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <MeMobileSubnav pathname="/hr/me/leave/new" />
        <SectionCard title="Leave request" subtitle="All fields are required unless noted">
          <MeLeaveRequestForm employeeName={employee.full_name} />
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
