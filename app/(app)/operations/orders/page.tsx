import { redirect } from "next/navigation";
import { OperationsOrderBoard } from "@/components/operations/OperationsOrderBoard";
import { OperationsSubpageShell } from "@/components/operations/OperationsSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsBackLink } from "@/components/operations/OperationsBackLink";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { computeOperationsSummary } from "@/lib/operations/helpers";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  OperationsOrderRow,
  OperationsSupplierRow,
} from "@/lib/operations/schemas";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const ORDER_SELECT =
  "id, business_id, number, customer_name, customer_phone, title, description, " +
  "status, fulfillment_type, fulfillment_status, due_date, amount_myr, supplier_id, notes, admin_file_id, completed_at, " +
  "created_by, created_at, updated_at";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!can(user.role, "operations")) {
    redirect("/home");
  }

  const params = await searchParams;
  const highlightOrderId =
    typeof params.order === "string" ? params.order : null;

  const admin = createServiceRoleClient();

  const [{ data: orders, error }, { data: suppliers }, { data: orderLeads }, summary] =
    await Promise.all([
      admin
        .from("operations_orders")
        .select(ORDER_SELECT)
        .eq("business_id", user.businessId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      admin
        .from("operations_suppliers")
        .select(
          "id, business_id, name, contact_name, phone, email, address, payment_terms, notes, admin_file_id, created_by, created_at, updated_at",
        )
        .eq("business_id", user.businessId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      admin
        .from("sales_leads")
        .select("id, source_order_id")
        .eq("business_id", user.businessId)
        .not("source_order_id", "is", null),
      computeOperationsSummary(admin, user.businessId),
    ]);

  const rows = (orders ?? []) as unknown as OperationsOrderRow[];
  const supplierRows = (suppliers ?? []) as unknown as OperationsSupplierRow[];

  const fileNames = await loadAdminFileNames(
    admin,
    user.businessId,
    rows.map((r) => r.admin_file_id).filter(Boolean) as string[],
  );

  const leadLinks = Object.fromEntries(
    (orderLeads ?? [])
      .filter((l) => l.source_order_id)
      .map((l) => [l.source_order_id as string, l.id as string]),
  );

  const nameLookup = new Map(supplierRows.map((s) => [s.id, s.name]));
  const enriched = rows.map((r) => ({
    ...r,
    supplier_name: r.supplier_id
      ? (nameLookup.get(r.supplier_id) ?? null)
      : null,
    admin_file_name: r.admin_file_id
      ? (fileNames.get(r.admin_file_id) ?? null)
      : null,
  }));

  const heroHeadline =
    summary.overdue_count > 0
      ? `${summary.overdue_count} order${summary.overdue_count === 1 ? "" : "s"} need a nudge`
      : summary.open_orders > 0
        ? `${summary.open_orders} on the board — keep it moving`
        : rows.length > 0
          ? "All caught up — nice work"
          : "Your order board is ready";

  const heroSub =
    summary.overdue_count > 0
      ? "Drag cards between columns or tap Advance. WhatsApp customers straight from a card."
      : summary.open_orders > 0
        ? "To do → In progress → Ready → Done. Drag or tap to advance each job."
        : "Log your first customer order — it only takes a few seconds.";

  if (error) {
    return (
      <div className="space-y-4">
        <OperationsBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load orders: {error.message}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <OperationsSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant={summary.overdue_count > 0 ? "attention" : "calm"}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="To do"
            value={summary.todo_count}
            iconClassName="text-slate-600 dark:text-slate-300"
          />
          <ModuleHeroStat
            label="In progress"
            value={summary.in_progress_count}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Ready"
            value={summary.ready_count}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Done"
            value={summary.done_this_month}
            hint="This month"
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      }
    >
      <OperationsOrderBoard
        initialOrders={enriched}
        suppliers={supplierRows}
        leadLinks={leadLinks}
        highlightOrderId={highlightOrderId}
      />
    </OperationsSubpageShell>
  );
}
