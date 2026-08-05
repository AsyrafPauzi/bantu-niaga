import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { complianceUrgency } from "@/lib/admin/task-compliance-schemas";
import { loadMissingStorageCategories } from "@/lib/admin/storage-usage";
import { createAgentScopedClient, verifyRows } from "./client";
import type { AgentContext, PillarSnapshot, SnapshotAttention, SnapshotItem } from "./types";

/**
 * Admin / business overview snapshot.
 *
 * Surfaces the tenant's plan, subscription window, and the last few
 * meaningful audit-log entries so the Boardroom agent can answer
 * "what changed recently" without scanning the full audit log.
 */
export async function buildAdminSnapshot(
  ctx: AgentContext,
  client?: SupabaseClient,
): Promise<PillarSnapshot> {
  const supabase = client ?? (await createAgentScopedClient(ctx));

  const businessRes = await supabase
    .from("businesses")
    .select(
      "id, name, tier, subscription_status, subscription_renewal_at, state_code, credit_balance, created_at",
    )
    .eq("id", ctx.businessId)
    .maybeSingle();

  const business = businessRes.data as
    | {
        id: string;
        name: string;
        tier: string;
        subscription_status: string | null;
        subscription_renewal_at: string | null;
        state_code: string | null;
        credit_balance: number | null;
        created_at: string;
      }
    | null;

  const auditRes = await supabase
    .from("audit_log")
    .select("id, business_id, action, entity_type, entity_id, created_at")
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false })
    .limit(10);

  const audit = verifyRows(auditRes, ctx, "audit_log");

  const [tasksRes, complianceRes, filesRes, missingStorageCats, financeNoReceiptRes, lowStockRes] =
    await Promise.all([
    supabase
      .from("admin_tasks")
      .select("id, business_id, title, column_id, due_date")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .is("completed_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("admin_compliance_items")
      .select("id, business_id, title, category, expires_on, status, admin_file_id")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .eq("status", "active")
      .order("expires_on", { ascending: true })
      .limit(20),
    supabase
      .from("admin_files")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null),
    loadMissingStorageCategories(supabase, ctx.businessId),
    supabase
      .from("finance_transactions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.businessId)
      .eq("kind", "expense")
      .is("deleted_at", null)
      .is("admin_file_id", null),
    supabase
      .from("operations_products")
      .select("id, stock_qty, low_stock_threshold")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .eq("is_active", true),
  ]);

  const openTasks = verifyRows(tasksRes, ctx, "admin_tasks");
  const complianceItems = verifyRows(complianceRes, ctx, "admin_compliance_items");
  const fileCount = filesRes.count ?? 0;
  const expensesWithoutReceipt = financeNoReceiptRes.count ?? 0;
  const lowStockCount = (lowStockRes.data ?? []).filter((row) => {
    const qty = row.stock_qty as number | null;
    if (qty == null) return false;
    const threshold = Number(row.low_stock_threshold ?? 5);
    return qty <= threshold;
  }).length;

  const expiringCompliance = complianceItems.filter(
    (item) => complianceUrgency(String(item.expires_on)) !== "ok",
  );

  const missingDocument = complianceItems.filter(
    (item) => !item.admin_file_id,
  );

  const recent: SnapshotItem[] = [
    ...openTasks.slice(0, 5).map((task) => ({
      id: task.id as string,
      label: `Task: ${task.title as string}`,
      meta: task.due_date ? `due ${task.due_date as string}` : "no due date",
      at: task.due_date as string | undefined,
    })),
    ...audit.slice(0, 5).map((a) => ({
      id: a.id as string,
      label: a.action as string,
      meta: `${a.entity_type ?? "—"}`,
      at: a.created_at as string,
    })),
  ];

  const attention: SnapshotAttention[] = [
    ...expiringCompliance.slice(0, 5).map((item) => {
      const urgency = complianceUrgency(String(item.expires_on));
      return {
        id: item.id as string,
        label: `Renewal: ${item.title as string} (expires ${item.expires_on as string})`,
        severity:
          urgency === "overdue"
            ? "high"
            : urgency === "soon"
              ? "medium"
              : "low",
      } as const;
    }),
    ...missingDocument.slice(0, 5).map((item) => {
      const urgency = complianceUrgency(String(item.expires_on));
      return {
        id: `missing-doc-${item.id as string}`,
        label: `Missing certificate: ${item.title as string} (expires ${item.expires_on as string})`,
        severity:
          urgency === "overdue" || urgency === "soon" ? "high" : "medium",
      } as const;
    }),
    ...missingStorageCats.slice(0, 3).map((gap) => ({
      id: `storage-gap-${gap.key}`,
      label: `Storage gap: no ${gap.label} on file`,
      severity: gap.key === "contract" ? ("high" as const) : ("medium" as const),
    })),
    ...(expensesWithoutReceipt > 0
      ? [
          {
            id: "finance-expenses-no-receipt",
            label: `${expensesWithoutReceipt} expense(s) have no receipt in Storage`,
            severity: "medium" as const,
          },
        ]
      : []),
    ...(lowStockCount > 0
      ? [
          {
            id: "operations-low-stock",
            label: `${lowStockCount} product(s) at or below low-stock threshold`,
            severity: "medium" as const,
          },
        ]
      : []),
  ];

  const generatedAt = new Date().toISOString();
  if (!business) {
    return {
      pillar: "admin",
      businessId: ctx.businessId,
      generatedAt,
      available: false,
      headline:
        "No business record found for this user. Cannot summarise admin state.",
      kpis: [],
      recent: [],
      attention: [],
    };
  }

  const renewalDate = business.subscription_renewal_at
    ? new Date(business.subscription_renewal_at)
    : null;
  const daysToRenewal = renewalDate
    ? Math.max(
        0,
        Math.round(
          (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return {
    pillar: "admin",
    businessId: ctx.businessId,
    generatedAt,
    available: true,
    headline: `Tenant "${business.name}" on tier=${business.tier} status=${business.subscription_status ?? "—"}.`,
    kpis: [
      { key: "tier", label: "Plan tier", value: business.tier },
      {
        key: "open_tasks",
        label: "Open tasks",
        value: openTasks.length,
      },
      {
        key: "compliance_renewals_due",
        label: "Renewals due (30d)",
        value: expiringCompliance.length,
      },
      {
        key: "compliance_missing_documents",
        label: "Licences missing certificate",
        value: missingDocument.length,
      },
      {
        key: "stored_documents",
        label: "Stored documents",
        value: fileCount,
      },
      {
        key: "storage_gaps",
        label: "Missing storage categories",
        value: missingStorageCats.length,
      },
      {
        key: "expenses_without_receipt",
        label: "Expenses missing receipt",
        value: expensesWithoutReceipt,
      },
      {
        key: "operations_low_stock",
        label: "Low-stock products",
        value: lowStockCount,
      },
      {
        key: "subscription_status",
        label: "Subscription",
        value: business.subscription_status ?? "—",
      },
      {
        key: "credit_balance",
        label: "Credit balance",
        value: business.credit_balance ?? 0,
        unit: "credits",
      },
      ...(daysToRenewal !== null
        ? [
            {
              key: "renewal_in_days",
              label: "Renews in",
              value: daysToRenewal,
              unit: "days",
            },
          ]
        : []),
      { key: "state_code", label: "State", value: business.state_code ?? "—" },
    ],
    recent,
    attention,
    notes:
      missingDocument.length > 0
        ? `${missingDocument.length} licence(s) have no uploaded certificate — open /admin/compliance to upload.`
        : missingStorageCats.length > 0
          ? `Storage is missing common doc types (e.g. ${missingStorageCats.map((g) => g.label).join(", ")}) — upload at /admin/storage.`
          : attention.length > 0
          ? `${attention.length} compliance renewal(s) need attention.`
          : daysToRenewal !== null && daysToRenewal <= 7
            ? `Subscription renews in ${daysToRenewal} day(s).`
            : openTasks.length > 0
              ? `${openTasks.length} open admin task(s) on the board.`
              : undefined,
  };
}
