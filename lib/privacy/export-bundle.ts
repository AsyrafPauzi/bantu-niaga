import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

import {
  EXPORT_ROW_LIMIT,
  type ExportCategoryId,
  type ExportScope,
} from "./export-catalog";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

async function fetchRows(
  admin: AdminClient,
  table: string,
  businessId: string,
  opts?: { userColumn?: string; userId?: string; limit?: number },
): Promise<unknown[]> {
  let q = admin.from(table).select("*").eq("business_id", businessId);
  if (opts?.userColumn && opts.userId) {
    q = q.eq(opts.userColumn, opts.userId);
  }
  const { data, error } = await q.limit(opts?.limit ?? EXPORT_ROW_LIMIT);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

function redactProfile(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    phone_e164: row.phone_e164,
    role: row.role,
    created_at: row.created_at,
    last_password_change_at: row.last_password_change_at,
  };
}

function redactApiKeys(rows: unknown[]) {
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id,
    label: r.label,
    key_prefix: r.key_prefix,
    scope: r.scope,
    last_used_at: r.last_used_at,
    created_at: r.created_at,
    revoked_at: r.revoked_at,
  }));
}

function redactWebhooks(rows: unknown[]) {
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id,
    url: r.url,
    events: r.events,
    active: r.active,
    delivered_count: r.delivered_count,
    failed_count: r.failed_count,
    last_delivered_at: r.last_delivered_at,
    created_at: r.created_at,
  }));
}

function redactTeamUsers(rows: unknown[]) {
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id,
    email: r.email,
    display_name: r.display_name,
    phone_e164: r.phone_e164,
    role: r.role,
    created_at: r.created_at,
  }));
}

async function loadCategory(
  admin: AdminClient,
  category: ExportCategoryId,
  userId: string,
  businessId: string,
): Promise<unknown> {
  switch (category) {
    case "profile": {
      const { data } = await admin
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      return { profile: redactProfile(data) };
    }
    case "consents":
      return {
        consents: await fetchRows(admin, "user_consents", businessId, {
          userColumn: "user_id",
          userId,
        }),
      };
    case "privacy_requests":
      return {
        data_subject_requests: await fetchRows(
          admin,
          "data_subject_requests",
          businessId,
          { userColumn: "user_id", userId },
        ),
      };
    case "audit_actions":
      return {
        audit_actions_taken_by_you: await fetchRows(
          admin,
          "audit_log",
          businessId,
          { userColumn: "actor_user_id", userId },
        ),
      };
    case "marketing_created": {
      const [socialAccounts, contentPlans] = await Promise.all([
        admin
          .from("social_accounts")
          .select(
            "id, provider, name, username, external_id, status, connected_at",
          )
          .eq("connected_by_user_id", userId)
          .limit(EXPORT_ROW_LIMIT)
          .then((r) => r.data ?? []),
        admin
          .from("content_plan")
          .select(
            "id, channel, status, scheduled_at, hook, caption, posted_at, created_at",
          )
          .eq("created_by", userId)
          .limit(EXPORT_ROW_LIMIT)
          .then((r) => r.data ?? []),
      ]);
      return {
        social_accounts_connected_by_you: socialAccounts,
        content_plans_created_by_you: contentPlans,
      };
    }
    case "customers_created":
      return {
        customers_created_by_you: await admin
          .from("customers")
          .select("*")
          .eq("business_id", businessId)
          .eq("created_by_user_id", userId)
          .limit(EXPORT_ROW_LIMIT)
          .then((r) => r.data ?? []),
      };
    case "business_profile": {
      const { data } = await admin
        .from("businesses")
        .select(
          "id, idcompany, name, state_code, tier, subscription_status, brand_primary_hex, brand_accent_hex, created_at",
        )
        .eq("id", businessId)
        .maybeSingle();
      return { business: data };
    }
    case "team": {
      const [users, invites, memberships] = await Promise.all([
        fetchRows(admin, "users", businessId).then(redactTeamUsers),
        fetchRows(admin, "team_invites", businessId),
        admin
          .from("user_business_memberships")
          .select("user_id, business_id, role, created_at")
          .eq("business_id", businessId)
          .limit(EXPORT_ROW_LIMIT)
          .then((r) => r.data ?? []),
      ]);
      return { team_members: users, team_invites: invites, memberships };
    }
    case "customers":
      return { customers: await fetchRows(admin, "customers", businessId) };
    case "finance": {
      const [invoices, transactions, creditLedger, legacyInvoices] =
        await Promise.all([
          fetchRows(admin, "finance_invoices", businessId),
          fetchRows(admin, "finance_transactions", businessId),
          fetchRows(admin, "credit_ledger", businessId),
          fetchRows(admin, "invoices", businessId),
        ]);
      return {
        finance_invoices: invoices,
        finance_transactions: transactions,
        credit_ledger: creditLedger,
        invoices_legacy: legacyInvoices,
      };
    }
    case "operations": {
      const [products, orders, bookings, resources, suppliers] =
        await Promise.all([
          fetchRows(admin, "operations_products", businessId),
          fetchRows(admin, "operations_orders", businessId),
          fetchRows(admin, "operations_bookings", businessId),
          fetchRows(admin, "operations_booking_resources", businessId),
          fetchRows(admin, "operations_suppliers", businessId),
        ]);
      return {
        operations_products: products,
        operations_orders: orders,
        operations_bookings: bookings,
        operations_booking_resources: resources,
        operations_suppliers: suppliers,
      };
    }
    case "sales": {
      const [sales, items, leads, leadNotes] = await Promise.all([
        fetchRows(admin, "pos_sales", businessId),
        fetchRows(admin, "pos_sale_items", businessId),
        fetchRows(admin, "sales_leads", businessId),
        fetchRows(admin, "sales_lead_notes", businessId),
      ]);
      return {
        pos_sales: sales,
        pos_sale_items: items,
        sales_leads: leads,
        sales_lead_notes: leadNotes,
      };
    }
    case "marketing": {
      const [
        segments,
        broadcasts,
        coupons,
        contentPlan,
        files,
        tagHistory,
        imports,
      ] = await Promise.all([
        fetchRows(admin, "customer_segments", businessId),
        fetchRows(admin, "broadcasts", businessId),
        fetchRows(admin, "coupons", businessId),
        fetchRows(admin, "content_plan", businessId),
        fetchRows(admin, "marketing_files", businessId),
        fetchRows(admin, "customer_tag_history", businessId),
        fetchRows(admin, "customer_csv_imports", businessId),
      ]);
      return {
        customer_segments: segments,
        broadcasts,
        coupons,
        content_plan: contentPlan,
        marketing_files: files,
        customer_tag_history: tagHistory,
        customer_csv_imports: imports,
      };
    }
    case "hr": {
      const [
        employees,
        documents,
        leaveRecords,
        leaveBalances,
        onboarding,
        appraisals,
        aiUsage,
      ] = await Promise.all([
        fetchRows(admin, "hr_employees", businessId),
        fetchRows(admin, "hr_employee_documents", businessId),
        fetchRows(admin, "hr_leave_records", businessId),
        fetchRows(admin, "hr_leave_balances", businessId),
        fetchRows(admin, "hr_onboarding_items", businessId),
        fetchRows(admin, "hr_staff_appraisals", businessId),
        fetchRows(admin, "ai_usage", businessId),
      ]);
      return {
        hr_employees: employees,
        hr_employee_documents: documents,
        hr_leave_records: leaveRecords,
        hr_leave_balances: leaveBalances,
        hr_onboarding_items: onboarding,
        hr_staff_appraisals: appraisals,
        ai_usage: aiUsage,
      };
    }
    case "integrations": {
      const [apiKeys, webhooks, addons] = await Promise.all([
        fetchRows(admin, "business_api_keys", businessId).then(redactApiKeys),
        fetchRows(admin, "business_webhooks", businessId).then(redactWebhooks),
        fetchRows(admin, "business_addons", businessId),
      ]);
      return {
        business_api_keys: apiKeys,
        business_webhooks: webhooks,
        business_addons: addons,
      };
    }
    case "audit_log":
      return { audit_log: await fetchRows(admin, "audit_log", businessId) };
    default:
      return {};
  }
}

export async function buildExportBundle(opts: {
  userId: string;
  businessId: string;
  scope: ExportScope;
  categories: ExportCategoryId[];
}): Promise<{ payload: Record<string, unknown>; byteSize: number }> {
  const admin = createServiceRoleClient();
  const { userId, businessId, scope, categories } = opts;

  const sections: Record<string, unknown> = {};
  for (const category of categories) {
    sections[category] = await loadCategory(
      admin,
      category,
      userId,
      businessId,
    );
  }

  const payload: Record<string, unknown> = {
    schema_version: "2.0",
    generated_at: new Date().toISOString(),
    scope,
    categories,
    row_limit_per_table: EXPORT_ROW_LIMIT,
    notice:
      scope === "personal"
        ? "Personal data Bantu Niaga holds for you in this business."
        : "Full business data export for the tenant. Secrets (API keys, webhook signing secrets) are excluded.",
    data: sections,
  };

  const json = JSON.stringify(payload);
  return { payload, byteSize: new TextEncoder().encode(json).length };
}
