import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ConsentMatrix } from "@/components/settings/privacy/ConsentMatrix";
import { DataExportCard } from "@/components/settings/privacy/DataExportCard";
import { DeleteAccountCard } from "@/components/settings/privacy/DeleteAccountCard";
import { PrivacyRequestsTable } from "@/components/settings/privacy/PrivacyRequestsTable";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/privacy/catalog";
import { loadConsents, loadUserDsrs } from "@/lib/privacy/load";
import type { DataSubjectRequest, UserConsent } from "@/lib/privacy/types";

export const metadata = {
  title: "Privacy & data",
  description: "Manage consent, export your data, or close your account (PDPA).",
};
export const dynamic = "force-dynamic";

export default async function PrivacySettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  let consents: UserConsent[] = [];
  let dsrs: DataSubjectRequest[] = [];
  try {
    [consents, dsrs] = await Promise.all([
      loadConsents(user.id, user.businessId),
      loadUserDsrs(user.id, 20),
    ]);
  } catch {
    consents = [];
    dsrs = [];
  }

  const pendingDeletion = dsrs.find(
    (r) =>
      (r.kind === "delete_user" || r.kind === "delete_business") &&
      r.status === "awaiting_grace",
  );

  const optionalGranted = consents.filter(
    (c) =>
      c.granted &&
      c.kind !== "terms_of_service" &&
      c.kind !== "privacy_notice",
  ).length;

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <PageHeader
        eyebrow="Settings · Privacy & data"
        title="Privacy & data"
        description={`Your PDPA rights — export data, manage consent, or close your account. Deletions have a ${ACCOUNT_DELETION_GRACE_DAYS}-day grace period.`}
      />

      {pendingDeletion ? (
        <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
          <ShieldAlert
            aria-hidden
            className="mt-0.5 h-5 w-5 text-[#8C5C0A] dark:text-[#F5C97A]"
            strokeWidth={2}
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              {pendingDeletion.kind === "delete_business"
                ? "This business is scheduled for permanent deletion."
                : "Your account is scheduled for permanent deletion."}
            </p>
            <p className="text-sm text-ink-muted dark:text-cream-400">
              Hard delete on{" "}
              <strong className="font-semibold text-ink dark:text-cream-100">
                {pendingDeletion.scheduledFor
                  ? new Date(pendingDeletion.scheduledFor).toLocaleDateString(
                      "en-MY",
                      { year: "numeric", month: "long", day: "numeric" },
                    )
                  : "—"}
              </strong>
              . Cancel below before that date.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Optional consents on" value={String(optionalGranted)} />
        <SummaryTile
          label="Privacy requests"
          value={String(dsrs.length)}
        />
        <SummaryTile
          label="Deletion grace"
          value={`${ACCOUNT_DELETION_GRACE_DAYS} days`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataExportCard />
        <DeleteAccountCard
          userRole={user.role}
          pendingDeletion={pendingDeletion ?? null}
        />
      </div>

      <ConsentMatrix initialConsents={consents} />

      <PrivacyRequestsTable initialRequests={dsrs} />

      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-sm dark:border-brand-800 dark:bg-brand-900/20">
        <p className="font-semibold text-ink dark:text-cream-100">
          Full Privacy Notice
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          Retention periods, sub-processors, and your full rights under PDPA
          2010 are in our public notice.
        </p>
        <Link
          href="/legal/privacy"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Read Privacy Notice
          <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-ink dark:text-cream-100">
        {value}
      </p>
    </div>
  );
}
