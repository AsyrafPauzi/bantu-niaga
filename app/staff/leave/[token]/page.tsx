import { notFound } from "next/navigation";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StaffLeaveRequestForm } from "@/components/hr/StaffLeaveRequestForm";
import { hashLeaveLinkToken, isLeaveLinkUsable } from "@/lib/hr/leave-links";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Apply Leave" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface LeaveLinkPageRow {
  id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  hr_employees: { full_name: string; role_title: string } | null;
}

async function loadLeaveLink(token: string): Promise<LeaveLinkPageRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("hr_leave_request_links")
    .select("id, expires_at, used_at, revoked_at, hr_employees(full_name, role_title)")
    .eq("token_hash", hashLeaveLinkToken(token))
    .maybeSingle();

  if (error) {
    throw new Error(`staff leave link lookup failed: ${error.message}`);
  }
  return data as unknown as LeaveLinkPageRow | null;
}

export default async function StaffLeavePage({ params }: PageProps) {
  const { token } = await params;
  const link = await loadLeaveLink(token);
  if (!link) notFound();

  const employee = link.hr_employees;
  const usable = isLeaveLinkUsable(link);

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70">
            Bantu Niaga HR
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            Leave Application
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            This private link expires after 24 hours and can be used once.
          </p>
        </header>

        <Card className="overflow-hidden border-hairline-light bg-panel-light dark:border-hairline-light dark:bg-panel-light">
          <CardHeader className="border-cream-200 dark:border-cream-200">
            <CardTitle className="text-ink dark:text-ink">
              Staff leave request
            </CardTitle>
            <CardDescription className="text-ink-muted dark:text-ink-muted">
              The employee name is locked to this secure HR link.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-5">
            {!usable ? (
              <div className="space-y-2 text-center">
                <h2 className="text-lg font-semibold text-ink">
                  Link expired
                </h2>
                <p className="text-sm text-ink-muted">
                  This leave link has expired. Please request a new link from your
                  manager.
                </p>
              </div>
            ) : employee ? (
              <>
                <div className="rounded-lg border border-cream-200 bg-brand-50/40 p-3">
                  <p className="text-sm font-semibold text-ink">
                    {employee.full_name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {employee.role_title}
                  </p>
                </div>
                <StaffLeaveRequestForm
                  token={token}
                  employeeName={employee.full_name}
                />
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Employee record was not found. Please request a new link from your
                manager.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
