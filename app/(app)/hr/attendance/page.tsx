import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrAttendanceClockInForm } from "@/components/hr/HrAttendanceClockInForm";
import { HrAttendanceGate } from "@/components/hr/HrAttendanceGate";
import { HrAttendanceList } from "@/components/hr/HrAttendanceList";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrClockEvents } from "@/lib/hr/attendance";
import { loadHrEmployees } from "@/lib/hr/load";
import { hasHrShiftAttendanceAddon } from "@/lib/marketplace/entitlements";

export const metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function HrAttendancePage() {
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
          You do not have access to attendance records.
        </CardBody>
      </Card>
    );
  }

  const [addonActive, employees, events] = await Promise.all([
    hasHrShiftAttendanceAddon(user.businessId),
    loadHrEmployees(user.businessId),
    loadHrClockEvents(user.businessId),
  ]);

  if (!addonActive) {
    return (
      <HrPageShell
        header={
          <HrPageHeader
            title="Attendance"
            subtitle="Track shift clock-in and clock-out"
            helpHref="/more"
          />
        }
      >
        <HrPageBody>
          <HrMobileSubnav />
          <HrAttendanceGate />
        </HrPageBody>
      </HrPageShell>
    );
  }

  const onShift = events.filter((row) => !row.clock_out).length;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Attendance"
          subtitle="Clock in staff and review shift records"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <SectionCard
            title="Shift log"
            subtitle={
              events.length === 0
                ? "No clock events yet"
                : `${onShift} on shift · ${events.length} records`
            }
          >
            <HrAttendanceList items={events} />
          </SectionCard>

          <SectionCard title="Clock in" subtitle="Manager clock-in for staff">
            <HrAttendanceClockInForm employees={employees} />
          </SectionCard>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
