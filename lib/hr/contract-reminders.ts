import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { malaysiaTodayIso } from "@/lib/ai/malaysia-today";
import { isAddonFeatureAccessible } from "@/lib/marketplace/addon-meta";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const CONTRACT_REMINDER_DAYS = [30, 14, 7] as const;

export interface ContractExpiringEmployee {
  id: string;
  full_name: string;
  role_title: string;
  contract_end_date: string;
  daysUntil: number;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysUntilContractEnd(
  contractEndDate: string,
  todayIso: string = malaysiaTodayIso(),
): number {
  const today = new Date(`${todayIso}T00:00:00`);
  const end = new Date(`${contractEndDate}T00:00:00`);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

export async function loadContractExpiringEmployees(
  client: SupabaseClient,
  businessId: string,
  todayIso: string = malaysiaTodayIso(),
): Promise<ContractExpiringEmployee[]> {
  const targetDates = CONTRACT_REMINDER_DAYS.map((days) =>
    addDaysIso(todayIso, days),
  );

  const { data, error } = await client
    .from("hr_employees")
    .select("id, full_name, role_title, contract_end_date")
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null)
    .not("contract_end_date", "is", null)
    .in("contract_end_date", targetDates);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name),
    role_title: String(row.role_title),
    contract_end_date: String(row.contract_end_date),
    daysUntil: daysUntilContractEnd(String(row.contract_end_date), todayIso),
  }));
}

export async function loadContractExpiringForOverview(
  businessId: string,
): Promise<ContractExpiringEmployee[]> {
  const supabase = await createSupabaseServerClient();
  const todayIso = malaysiaTodayIso();
  const horizon = addDaysIso(todayIso, 30);

  const { data, error } = await supabase
    .from("hr_employees")
    .select("id, full_name, role_title, contract_end_date")
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null)
    .not("contract_end_date", "is", null)
    .gte("contract_end_date", todayIso)
    .lte("contract_end_date", horizon)
    .order("contract_end_date", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name),
    role_title: String(row.role_title),
    contract_end_date: String(row.contract_end_date),
    daysUntil: daysUntilContractEnd(String(row.contract_end_date), todayIso),
  }));
}

export async function loadBusinessesWithReminderPack(
  client: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await client
    .from("business_addons")
    .select("id, business_id, status, meta, marketplace_addons!inner(slug)")
    .in("status", ["active", "pending_cancel"])
    .eq("marketplace_addons.slug", "hr-reminder-pack");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) =>
      isAddonFeatureAccessible({
        id: String(row.id),
        business_id: String(row.business_id),
        addon_id: "",
        status: row.status as "active" | "pending_cancel" | "cancelled",
        activated_at: "",
        next_charge_at: null,
        cancel_at: null,
        qty: 1,
        meta: (row.meta as Record<string, unknown>) ?? {},
      }),
    )
    .map((row) => String(row.business_id));
}
