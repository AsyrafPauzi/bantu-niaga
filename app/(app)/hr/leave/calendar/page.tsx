import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { HrLeaveCalendar } from "@/components/hr/HrLeaveCalendar";
import { HrLeaveMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees, loadHrLeaveRecords } from "@/lib/hr/load";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Leave calendar" };
export const dynamic = "force-dynamic";

export default async function LeaveCalendarPage() {
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

  const [leave, employees] = await Promise.all([
    loadHrLeaveRecords(user.businessId),
    loadHrEmployees(user.businessId),
  ]);

  return (
    <div className="space-y-6">
      <HrMobileSubnav />
      <HrLeaveMobileSubnav />

      <section
        className={cn(
          "relative overflow-hidden rounded-xl border p-4 shadow-sm sm:p-5",
          hrClasses.heroBorder,
          hrClasses.heroBg,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold uppercase tracking-widest", hrClasses.textMuted)}>
              HR · Leave calendar
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink dark:text-cream-100 sm:text-2xl">
              Team leave grid
            </h1>
            <p className="mt-0.5 max-w-lg text-sm text-ink-muted dark:text-cream-400">
              Approved and pending leave by employee for each day of the month.
            </p>
          </div>
          <Link
            href="/hr/leave"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
              hrClasses.btnSecondary,
            )}
          >
            Back to inbox
          </Link>
        </div>
      </section>

      <HrLeaveCalendar leave={leave} employees={employees} />

      <div className="pb-16 lg:pb-6" />
    </div>
  );
}
