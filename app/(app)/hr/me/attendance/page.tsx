import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { HrAttendanceGate } from "@/components/hr/HrAttendanceGate";
import { HrMeAttendancePanel } from "@/components/hr/me/HrMeAttendancePanel";
import { MePageFrame } from "@/components/hr/me/MePageFrame";
import {
  loadHrClockEventsPage,
  loadOpenClockEvent,
  type HrClockShiftFilter,
} from "@/lib/hr/attendance";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import { hasHrShiftAttendanceAddon } from "@/lib/marketplace/entitlements";
import { ADMIN_DEFAULT_PAGE_SIZE, parsePagination } from "@/lib/pagination";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

function parseShift(
  raw: string | string[] | undefined,
): HrClockShiftFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "open" || value === "closed") return value;
  return "all";
}

export default async function HrMeAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const addonActive = await hasHrShiftAttendanceAddon(ctx.user.businessId);

  if (!addonActive) {
    return (
      <MePageFrame
        pathname="/hr/me/attendance"
        title="Attendance"
        subtitle="Clock in and out for your shifts"
      >
        <div className="rounded-xl border border-cream-200 bg-white p-2 dark:border-hairline-dark dark:bg-panel-dark">
          <HrAttendanceGate />
        </div>
        <p className="text-center text-xs text-ink-muted dark:text-cream-500">
          Ask your owner to turn on Shift Attendance if you need to clock in
          here.
        </p>
      </MePageFrame>
    );
  }

  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
  });
  const shiftFilter = parseShift(params.shift);

  const admin = createServiceRoleClient();
  const [pageResult, openEvent] = await Promise.all([
    loadHrClockEventsPage(ctx.user.businessId, {
      employeeId: ctx.employee.id,
      shift: shiftFilter,
      from: pagination.from,
      to: pagination.to,
    }),
    loadOpenClockEvent(admin, ctx.user.businessId, ctx.employee.id),
  ]);

  return (
    <MePageFrame
      pathname="/hr/me/attendance"
      title="Attendance"
      subtitle="Clock in when you start · clock out when you finish"
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Status"
            value={openEvent ? "On shift" : "Off"}
            pillar="hr"
            iconClassName="text-[#0F766E] dark:text-teal-300"
          />
          <ModuleHeroStat
            label="Records"
            value={pageResult.total}
            pillar="hr"
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Filter"
            value={
              shiftFilter === "all"
                ? "All"
                : shiftFilter === "open"
                  ? "On shift"
                  : "Completed"
            }
            pillar="hr"
            iconClassName="text-ink-muted dark:text-cream-400"
          />
        </div>
      }
    >
      <HrMeAttendancePanel
        events={pageResult.rows}
        openEvent={openEvent}
        shiftFilter={shiftFilter}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageResult.total}
      />
    </MePageFrame>
  );
}
