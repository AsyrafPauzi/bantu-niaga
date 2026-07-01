import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { AdminCompliancePanel } from "@/components/admin/AdminCompliancePanel";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  complianceUrgency,
  daysUntil,
  type AdminComplianceRow,
} from "@/lib/admin/task-compliance-schemas";

export const metadata = { title: "Compliance" };
export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "admin", "compliance")) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin"
          title="Licence & permit tracker"
          description="Never miss an SSM, DBKL, or insurance renewal again."
        />
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              You don&apos;t have access to compliance tracking.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_compliance_items")
    .select(
      "id, business_id, title, category, authority, reference_number, " +
        "expires_on, remind_days, notes, status, last_renewed_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .eq("status", "active")
    .order("expires_on", { ascending: true });

  const items = ((data ?? []) as unknown as AdminComplianceRow[]).map((row) => ({
    ...row,
    days_until_expiry: daysUntil(row.expires_on),
    urgency: complianceUrgency(row.expires_on),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Licence & permit tracker"
        description="Track SSM, DBKL signboard licences, insurance, and other renewals before they expire."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load compliance items: {error.message}
          </CardBody>
        </Card>
      ) : (
        <AdminCompliancePanel initialItems={items} />
      )}
    </div>
  );
}
