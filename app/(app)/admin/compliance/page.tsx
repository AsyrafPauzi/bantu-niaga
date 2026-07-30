import { redirect } from "next/navigation";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { AdminCompliancePanel } from "@/components/admin/AdminCompliancePanel";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import {
  COMPLIANCE_SELECT,
  enrichComplianceRows,
} from "@/lib/admin/compliance-server";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdminComplianceRow,
  ComplianceInAppAlert,
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
        <AdminBackLink />
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

  const [itemsRes, alertsRes] = await Promise.all([
    supabase
      .from("admin_compliance_items")
      .select(COMPLIANCE_SELECT)
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .eq("status", "active")
      .order("expires_on", { ascending: true }),
    supabase
      .from("compliance_in_app_alerts")
      .select(
        "id, business_id, compliance_item_id, notice_date, days_before, message, dismissed_at, created_at",
      )
      .eq("business_id", user.businessId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const items = await enrichComplianceRows(
    supabase,
    (itemsRes.data ?? []) as unknown as AdminComplianceRow[],
  );

  const alerts = (alertsRes.data ?? []) as ComplianceInAppAlert[];
  const error = itemsRes.error;

  return (
    <div className="space-y-6">
      <AdminBackLink />

      <PageHeader
        eyebrow="Admin · Compliance"
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
        <AdminCompliancePanel
          initialItems={items}
          initialAlerts={alerts}
        />
      )}
    </div>
  );
}
