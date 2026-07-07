import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { SectionCard } from "@/components/dashboard/section-card";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { documentTypeLabel } from "@/lib/hr/profile-completion";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrDocuments } from "@/lib/hr/load";

export const metadata = { title: "Staff documents" };
export const dynamic = "force-dynamic";

export default async function HrDocumentsPage() {
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
          You do not have access to staff documents.
        </CardBody>
      </Card>
    );
  }

  const documents = await loadHrDocuments(user.businessId);

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Staff documents"
          subtitle="All employee files in one folder — IC, bank, contracts, and more"
          helpHref="/more"
        />
      }
    >
      <HrPageBody>
        <HrMobileSubnav />

        <SectionCard
          title="Document library"
          subtitle={`${documents.length} file(s) linked across your team`}
        >
          {documents.length === 0 ? (
            <p className="text-sm text-ink-muted dark:text-cream-400">
              No documents yet. Upload from an{" "}
              <Link href="/hr/employees" className="font-semibold text-brand-700">
                employee profile
              </Link>
              .
            </p>
          ) : (
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-cream-100">
                      {doc.label}
                    </p>
                    <p className="text-xs text-ink-muted dark:text-cream-400">
                      {doc.hr_employees?.full_name ?? "Employee"} ·{" "}
                      {documentTypeLabel(doc.document_type)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/hr/employees/${doc.employee_id}`}
                      className="text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400"
                    >
                      View profile
                    </Link>
                    {doc.admin_file_id ? (
                      <a
                        href={`/api/hr/documents/${doc.id}/download`}
                        className="text-xs font-semibold text-brand-700 dark:text-brand-200"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-ink-subtle">No file</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
