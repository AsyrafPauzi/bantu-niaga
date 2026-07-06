"use client";

import Link from "next/link";
import { HrLeaveLinkActions } from "@/components/hr/HrLeaveLinkActions";
import { HrInfoBanner } from "@/components/hr/layout/hr-info-banner";

export function HrShareLeavePanel({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 dark:border-hairline-dark dark:bg-panel-dark">
        <h2 className="text-base font-bold text-ink dark:text-cream-100">
          Generate private link
        </h2>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Staff name is locked to <strong>{employeeName}</strong>. The link expires in 24 hours.
        </p>
        <div className="mt-4">
          <HrLeaveLinkActions
            employeeId={employeeId}
            employeeName={employeeName}
            align="start"
          />
        </div>
      </div>
      <HrInfoBanner
        title="How staff use this link"
        description="Share via WhatsApp or copy the link. Staff complete the form on their phone — you approve leave from the Leave page."
      />
      <p className="text-sm text-ink-muted dark:text-cream-400">
        <Link
          href={`/hr/employees/${employeeId}`}
          className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Back to employee profile
        </Link>
      </p>
    </div>
  );
}
