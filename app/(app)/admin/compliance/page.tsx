import { redirect } from "next/navigation";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminCustomEntryButton } from "@/components/admin/AdminCustomEntryButton";
import { AdminSubpageShell } from "@/components/admin/AdminSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
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
      <div className="space-y-4">
        <AdminBackLink />
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

  const overdue = items.filter((i) => i.urgency === "overdue").length;
  const dueSoon = items.filter((i) => i.urgency === "soon").length;
  const withDocs = items.filter((i) => i.admin_file_id).length;

  const heroHeadline =
    overdue > 0
      ? `${overdue} renewal${overdue === 1 ? "" : "s"} overdue`
      : dueSoon > 0
        ? `${dueSoon} due within 30 days`
        : items.length > 0
          ? `${items.length} licence${items.length === 1 ? "" : "s"} on track`
          : "Log your first renewal";

  const heroSub =
    overdue > 0
      ? "Update expiry dates or upload proof before an inspection catches you off guard."
      : dueSoon > 0
        ? "Renew SSM, DBKL signboards, insurance, and permits before they lapse."
        : items.length > 0
          ? "Switch list or calendar view — attach PDFs and set reminder windows."
          : "Start with SSM or your most critical permit — Amir can coach you later.";

  if (error) {
    return (
      <div className="space-y-4">
        <AdminBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load compliance items: {error.message}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <AdminSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant={overdue > 0 ? "attention" : dueSoon > 0 ? "attention" : "calm"}
      action={<AdminCustomEntryButton />}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Active"
            value={items.length}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Due soon"
            value={dueSoon}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Overdue"
            value={overdue}
            iconClassName="text-rose-700 dark:text-rose-300"
          />
          <ModuleHeroStat
            label="With file"
            value={withDocs}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      }
    >
      <AdminCompliancePanel initialItems={items} initialAlerts={alerts} />
    </AdminSubpageShell>
  );
}
