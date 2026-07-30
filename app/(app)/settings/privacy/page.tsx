import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ConsentMatrix } from "@/components/settings/privacy/ConsentMatrix";
import { DataExportCard } from "@/components/settings/privacy/DataExportCard";
import { DeleteAccountCard } from "@/components/settings/privacy/DeleteAccountCard";
import { PrivacyRequestsTable } from "@/components/settings/privacy/PrivacyRequestsTable";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadConsents, countUserDsrs, loadPendingDeletionRequest, loadUserDsrs } from "@/lib/privacy/load";
import type { DataSubjectRequest, UserConsent } from "@/lib/privacy/types";

export const metadata = { title: "Privacy & data" };
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
  let dsrTotal = 0;
  let pendingDeletion: DataSubjectRequest | null = null;
  try {
    [consents, dsrs, dsrTotal, pendingDeletion] = await Promise.all([
      loadConsents(user.id, user.businessId),
      loadUserDsrs(user.id, 10),
      countUserDsrs(user.id),
      loadPendingDeletionRequest(user.id),
    ]);
  } catch {
    consents = [];
    dsrs = [];
    dsrTotal = 0;
    pendingDeletion = null;
  }

  const optionalGranted = consents.filter(
    (c) =>
      c.granted &&
      c.kind !== "terms_of_service" &&
      c.kind !== "privacy_notice",
  ).length;

  const summaryParts = [
    `${optionalGranted} optional on`,
    `${dsrTotal} request${dsrTotal === 1 ? "" : "s"}`,
  ];

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Privacy & data"
        description={summaryParts.join(" · ")}
      />

      {pendingDeletion ? (
        <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
          <ShieldAlert
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-[#8C5C0A] dark:text-[#F5C97A]"
            strokeWidth={2}
          />
          <div className="min-w-0 space-y-1">
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

      <ConsentMatrix initialConsents={consents} />

      <DataExportCard isOwner={user.role === "owner"} />

      <DeleteAccountCard
        userRole={user.role}
        pendingDeletion={pendingDeletion ?? null}
      />

      <PrivacyRequestsTable
        initialRequests={dsrs}
        totalCount={dsrTotal}
        listLimit={10}
      />

      <p className="text-center text-xs text-ink-muted dark:text-cream-400">
        Full retention schedule and PDPA rights in our{" "}
        <Link
          href="/legal/privacy"
          className="font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
        >
          Privacy Notice
        </Link>
        .
      </p>
    </>
  );
}
