import type { SupabaseClient } from "@supabase/supabase-js";

/** Child tables first — tenant data only (keeps businesses + users rows). */
const PURGE_TABLES: readonly string[] = [
  "admin_compliance_renewal_events",
  "admin_document_templates",
  "admin_internal_notes",
  "admin_tasks",
  "admin_task_columns",
  "agent_daily_notices",
  "ai_agent_usage_daily",
  "ai_chat_short_memory",
  "ai_usage",
  "audit_log",
  "billplz_payment_intents",
  "boardroom_messages",
  "business_addons",
  "business_agent_settings",
  "business_api_keys",
  "business_holiday_overrides",
  "business_notifications",
  "business_webhooks",
  "compliance_in_app_alerts",
  "content_plan_media",
  "credit_ledger",
  "customer_csv_imports",
  "customer_tag_history",
  "data_exports",
  "events_outbox",
  "finance_billplz_intents",
  "finance_invoice_handler_dedup",
  "finance_invoice_items",
  "hr_employee_documents",
  "hr_leave_balances",
  "hr_leave_request_links",
  "hr_onboarding_items",
  "hr_staff_appraisals",
  "marketing_event_dedup",
  "marketing_files",
  "operations_bookings",
  "operations_orders",
  "operations_services",
  "operations_staff_availability_blocks",
  "pos_sale_items",
  "sales_event_dedup",
  "sales_lead_notes",
  "social_post_metrics",
  "team_invites",
  "tenant_health_snapshots",
  "user_consents",
  "admin_compliance_items",
  "admin_files",
  "boardroom_meetings",
  "broadcasts",
  "coupons",
  "data_subject_requests",
  "hr_leave_records",
  "hr_public_holidays",
  "finance_transactions",
  "finance_invoices",
  "operations_booking_resources",
  "operations_products",
  "operations_suppliers",
  "pos_sales",
  "sales_leads",
  "social_post_publishes",
  "content_plan",
  "customer_segments",
  "hr_employees",
  "payment_methods",
  "social_accounts",
  "customers",
];

async function deleteJunctionByBroadcasts(
  admin: SupabaseClient,
  businessId: string,
): Promise<void> {
  const { data } = await admin
    .from("broadcasts")
    .select("id")
    .eq("business_id", businessId);
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length === 0) return;
  const { error } = await admin
    .from("broadcast_recipients")
    .delete()
    .in("broadcast_id", ids);
  if (error) throw new Error(`broadcast_recipients: ${error.message}`);
}

async function deleteJunctionByCoupons(
  admin: SupabaseClient,
  businessId: string,
): Promise<void> {
  const { data } = await admin
    .from("coupons")
    .select("id")
    .eq("business_id", businessId);
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length === 0) return;
  const { error } = await admin
    .from("coupon_redemptions")
    .delete()
    .in("coupon_id", ids);
  if (error) throw new Error(`coupon_redemptions: ${error.message}`);
}

export async function purgeDemoBusinessData(
  admin: SupabaseClient,
  businessId: string,
): Promise<void> {
  console.log(`[purge] wiping tenant data for ${businessId}…`);

  await deleteJunctionByBroadcasts(admin, businessId);
  await deleteJunctionByCoupons(admin, businessId);

  for (const table of PURGE_TABLES) {
    const { error } = await admin.from(table).delete().eq("business_id", businessId);
    if (error) {
      if (
        error.message.includes("does not exist") ||
        error.message.includes("Could not find the table")
      ) {
        console.warn(`[purge] skip missing table ${table}`);
        continue;
      }
      throw new Error(`${table}: ${error.message}`);
    }
    console.log(`[purge]   ${table}`);
  }

  console.log("[purge] done.");
}
