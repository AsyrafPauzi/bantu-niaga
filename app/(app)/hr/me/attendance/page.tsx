import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrAttendanceGate } from "@/components/hr/HrAttendanceGate";
import { HrMeAttendancePanel } from "@/components/hr/me/HrMeAttendancePanel";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import {
  loadHrClockEvents,
  loadOpenClockEvent,
} from "@/lib/hr/attendance";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import { hasHrShiftAttendanceAddon } from "@/lib/marketplace/entitlements";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "My attendance" };
export const dynamic = "force-dynamic";

export default async function HrMeAttendancePage() {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const addonActive = await hasHrShiftAttendanceAddon(ctx.user.businessId);

  if (!addonActive) {
    return (
      <HrPageShell
        header={
          <HrPageHeader
            title="My attendance"
            subtitle={`${ctx.employee.full_name} · ${ctx.employee.role_title}`}
          />
        }
      >
        <HrPageBody>
          <MeMobileSubnav pathname="/hr/me/attendance" />
          <HrAttendanceGate />
        </HrPageBody>
      </HrPageShell>
    );
  }

  const admin = createServiceRoleClient();
  const [events, openEvent] = await Promise.all([
    loadHrClockEvents(ctx.user.businessId, {
      employeeId: ctx.employee.id,
      limit: 30,
    }),
    loadOpenClockEvent(admin, ctx.user.businessId, ctx.employee.id),
  ]);

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="My attendance"
          subtitle={`${ctx.employee.full_name} · ${ctx.employee.role_title}`}
          action={
            <Link
              href="/hr/me"
              className="text-[13px] font-semibold text-brand-700 dark:text-brand-200"
            >
              Back to overview
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <MeMobileSubnav pathname="/hr/me/attendance" />

        <SectionCard title="Clock in / out" subtitle="Record your shift times">
          <HrMeAttendancePanel events={events} openEvent={openEvent} />
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
