import Image from "next/image";
import { notFound } from "next/navigation";
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
    <main className="flex min-h-dvh flex-col items-center bg-[#FAF7F2] px-6 py-8">
      <div className="flex w-full max-w-[480px] flex-col items-center gap-6">
        <Image
          src="/icon.png"
          alt="Bantu Niaga"
          width={48}
          height={48}
          className="h-12 w-12"
        />

        <header className="w-full space-y-2 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-700">
            Bantu Niaga HR
          </p>
          <h1 className="text-2xl font-bold text-ink">Leave application</h1>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            This private link expires in 24 hours and can only be used once.
          </p>
        </header>

        <div className="w-full rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-sm">
          {!usable ? (
            <div className="space-y-2 py-4 text-center">
              <h2 className="text-lg font-semibold text-ink">Link expired</h2>
              <p className="text-sm text-ink-muted">
                This leave link has expired. Please request a new link from your
                manager.
              </p>
            </div>
          ) : employee ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#D5E2FB] bg-[#EEF3FE] p-3.5">
                <p className="text-[11px] font-semibold text-ink-muted">
                  Staff name (locked)
                </p>
                <p className="mt-1 text-base font-bold text-ink">
                  {employee.full_name}
                </p>
                <p className="text-xs text-ink-muted">{employee.role_title}</p>
              </div>
              <StaffLeaveRequestForm
                token={token}
                employeeName={employee.full_name}
              />
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-ink-muted">
              Employee record was not found. Please request a new link from your
              manager.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-ink-muted">
          Your manager will review and approve your request.
        </p>
      </div>
    </main>
  );
}
