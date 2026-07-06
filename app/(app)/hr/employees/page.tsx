import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2, UserPlus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrEmployeeSearchList } from "@/components/hr/HrEmployeeSearchList";
import { HrActionRow } from "@/components/hr/layout/hr-action-row";
import { HrKpiGrid } from "@/components/hr/layout/hr-kpi-grid";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees } from "@/lib/hr/load";

export const metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
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
          You do not have access to employee records.
        </CardBody>
      </Card>
    );
  }

  const employees = await loadHrEmployees(user.businessId);
  const activeCount = employees.filter((e) => e.status === "active").length;
  const withBank = employees.filter((e) => e.bank_name || e.bank_account_no).length;
  const missingInfo = employees.filter(
    (e) => !e.emergency_contact_name || !e.emergency_contact_phone,
  ).length;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Employees"
          subtitle="View and manage everyone on your team"
          helpHref="/more"
          action={
            <Link
              href="/hr/employees/new"
              className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              + Add employee
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <HrKpiGrid>
          <KpiTileBig
            label="Total staff"
            value={String(employees.length)}
            sublabel="on your team"
            tone="brand"
          />
          <KpiTileBig
            label="Active"
            value={String(activeCount)}
            sublabel="currently working"
            tone="success"
          />
          <KpiTileBig
            label="Bank ready"
            value={String(withBank)}
            sublabel="details saved"
            tone="accent"
          />
          <KpiTileBig
            label="Missing info"
            value={String(missingInfo)}
            sublabel="emergency contact"
            tone={missingInfo > 0 ? "warning" : "success"}
          />
        </HrKpiGrid>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <HrActionRow
            href="/hr/employees/new"
            title="Add employee"
            helper="Create a new staff profile"
            icon={UserPlus}
            tone="brand"
          />
          <HrActionRow
            href="/hr/employees"
            title="Share leave form"
            helper="Send a private WhatsApp link"
            icon={Link2}
            tone="accent"
          />
        </div>

        <SectionCard
          title="All staff members"
          subtitle="Use the icons to edit, share leave link, or remove a staff member"
        >
          <HrEmployeeSearchList employees={employees} />
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
