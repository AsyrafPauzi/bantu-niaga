import Link from "next/link";
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import type { BalanceLine } from "@/lib/hr/leave-balance-display";
import type { HrOnboardingRow } from "@/lib/hr/load";
import { cn } from "@/lib/utils/cn";

export function HrMeOverview({
  balanceLines,
  pendingCount,
  onboarding,
  leavePanel,
}: {
  balanceLines: BalanceLine[];
  pendingCount: number;
  onboarding: HrOnboardingRow[];
  leavePanel: ReactNode;
}) {
  const onboardingDone = onboarding.filter((i) => i.is_done).length;
  const onboardingOpen =
    onboarding.length > 0 && onboardingDone < onboarding.length;

  const quickActions: Array<{
    href: string;
    label: string;
    hint: string;
    icon: typeof CalendarPlus;
    primary: boolean;
    badge?: number;
  }> = [
    {
      href: "/hr/me/leave/new",
      label: "Apply leave",
      hint: "Request time off",
      icon: CalendarPlus,
      primary: true,
    },
    {
      href: "/hr/me/attendance",
      label: "Attendance",
      hint: "Clock in / out",
      icon: Clock,
      primary: false,
    },
    {
      href: "/hr/me/payslips",
      label: "Payslips",
      hint: "View & download",
      icon: Wallet,
      primary: false,
    },
    {
      href: "/hr/me/onboarding",
      label: "Onboarding",
      hint:
        onboarding.length > 0
          ? `${onboardingDone}/${onboarding.length} done`
          : "Checklist",
      icon: ClipboardList,
      primary: false,
      badge: onboardingOpen ? onboarding.length - onboardingDone : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      {pendingCount > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              {pendingCount} request{pendingCount === 1 ? "" : "s"} waiting for
              approval
            </p>
            <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
              Your manager will review soon. You can cancel while it&apos;s
              still pending.
            </p>
          </div>
        </div>
      ) : null}

      <section aria-label="Quick actions">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
            Shortcuts
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {quickActions.map(
            ({ href, label, hint, icon: Icon, primary, badge }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex min-h-[5.5rem] flex-col justify-between rounded-xl border p-3.5 transition active:scale-[0.98]",
                  primary
                    ? "border-teal-300/80 bg-teal-50/90 dark:border-teal-800 dark:bg-teal-950/40"
                    : "border-cream-200 bg-white hover:border-teal-200 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-teal-900",
                )}
              >
                {badge != null && badge > 0 ? (
                  <span className="absolute right-2.5 top-2.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#0D9488] px-1 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl",
                    primary
                      ? "bg-[#0D9488] text-white"
                      : "bg-cream-100 text-[#0F766E] dark:bg-hairline-dark dark:text-teal-300",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink dark:text-cream-100">
                    {label}
                  </p>
                  <p className="text-[11px] text-ink-muted dark:text-cream-500">
                    {hint}
                  </p>
                </div>
              </Link>
            ),
          )}
        </div>
      </section>

      <section aria-label="Leave balance">
        <div className="mb-2 flex items-end justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-500">
            Leave balance
          </h2>
          <p className="text-xs text-ink-muted dark:text-cream-500">
            Days left this year
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {balanceLines.map((line) => {
            const configured = line.entitlement != null;
            const pct =
              configured &&
              line.entitlement &&
              line.entitlement > 0 &&
              line.remaining != null
                ? Math.round((line.remaining / line.entitlement) * 100)
                : 0;
            return (
              <div
                key={line.key}
                className="rounded-xl border border-cream-200 bg-white p-3.5 dark:border-hairline-dark dark:bg-panel-dark"
              >
                <p className="text-[11px] font-semibold text-ink-muted dark:text-cream-500">
                  {shortBalanceLabel(line.key, line.label)}
                </p>
                {configured ? (
                  <>
                    <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-ink dark:text-cream-100">
                      {line.remaining}
                      <span className="text-sm font-semibold text-ink-muted dark:text-cream-500">
                        {" "}
                        left
                      </span>
                    </p>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-cream-100 dark:bg-hairline-dark">
                      <div
                        className="h-full rounded-full bg-[#0D9488] transition-[width]"
                        style={{
                          width: `${Math.min(100, Math.max(0, pct))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-muted dark:text-cream-500">
                      {line.used ?? 0} used · {line.entitlement} total
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-lg font-bold text-ink-muted dark:text-cream-400">
                      No quota
                    </p>
                    <p className="mt-1.5 text-[11px] text-ink-muted dark:text-cream-500">
                      {(line.used ?? 0) > 0
                        ? `${line.used} day(s) taken`
                        : "Ask HR to set a limit"}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {onboardingOpen ? (
        <Link
          href="/hr/me/onboarding"
          className="flex items-center gap-3 rounded-xl border border-teal-200/80 bg-teal-50/70 px-4 py-3.5 transition hover:bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0D9488] text-white">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              Finish onboarding
            </p>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {onboardingDone} of {onboarding.length} steps done — tap to
              continue
            </p>
          </div>
          <span className="text-sm font-semibold text-[#0F766E] dark:text-teal-300">
            →
          </span>
        </Link>
      ) : null}

      {leavePanel}
    </div>
  );
}

function shortBalanceLabel(
  key: BalanceLine["key"],
  fallback: string,
): string {
  switch (key) {
    case "annual":
      return "Annual";
    case "mc":
      return "Medical (MC)";
    case "emergency":
      return "Emergency";
    case "hospitalisation":
      return "Hospitalisation";
    default:
      return fallback;
  }
}
