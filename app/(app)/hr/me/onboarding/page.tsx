import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { OnboardingProgressBar } from "@/components/hr/HrOnboardingProgress";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { loadStaffMeOnboardingItems } from "@/lib/hr/load";
import {
  formatOnboardingProgress,
  onboardingProgressFromCounts,
} from "@/lib/hr/onboarding-progress";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";

export const metadata = { title: "My onboarding" };
export const dynamic = "force-dynamic";

export default async function HrMeOnboardingPage() {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const items = await loadStaffMeOnboardingItems(
    ctx.user.businessId,
    ctx.employee.id,
  );
  const done = items.filter((item) => item.is_done).length;
  const progress = onboardingProgressFromCounts(done, items.length);

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Onboarding checklist"
          subtitle="Tasks HR assigned when you joined"
          action={
            <Link
              href="/hr/me"
              className="inline-flex rounded-[10px] border border-hairline-light bg-cream-100 px-3.5 py-2.5 text-[13px] font-semibold text-brand-700 dark:border-hairline-dark dark:bg-panel-dark dark:text-brand-200"
            >
              ← Back
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <MeMobileSubnav pathname="/hr/me/onboarding" />

        {items.length === 0 ? (
          <SectionCard title="No checklist yet">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              HR has not assigned onboarding tasks to your profile yet.
            </p>
          </SectionCard>
        ) : (
          <SectionCard
            title="Your tasks"
            subtitle={formatOnboardingProgress(progress)}
            bodyClassName="space-y-4"
          >
            <OnboardingProgressBar progress={progress} />
            <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="text-ink dark:text-cream-100">{item.label}</span>
                  <span
                    className={
                      item.is_done
                        ? "text-xs font-semibold text-status-success"
                        : "text-xs font-semibold text-ink-muted"
                    }
                  >
                    {item.is_done ? "Done" : "To do"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Ask HR to mark items complete — you can view progress here.
            </p>
          </SectionCard>
        )}
      </HrPageBody>
    </HrPageShell>
  );
}
