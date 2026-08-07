import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TierKey } from "@/lib/settings/plans";
import { tierBy } from "@/lib/settings/plans";
import {
  isFreeTier,
  FREE_TIER_CUSTOMERS_MAX,
  FREE_TIER_EMAILS_PER_MONTH,
  FREE_TIER_INVOICES_PER_MONTH,
} from "@/lib/settings/tier-agents";

export type FreeTierLimitKind =
  | "expenses"
  | "invoices"
  | "emails"
  | "customers"
  | "quotes"
  | "duitnow"
  | "ledger_export";

export interface FreeTierLimitPayload {
  error: "free_tier_limit";
  limit: FreeTierLimitKind;
  message: string;
  upgrade_tier: TierKey;
  current?: number;
  max?: number;
}

export class FreeTierLimitError extends Error {
  readonly code = "free_tier_limit" as const;
  readonly payload: FreeTierLimitPayload;

  constructor(payload: FreeTierLimitPayload) {
    super(payload.message);
    this.name = "FreeTierLimitError";
    this.payload = payload;
  }
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function freeTierLimitResponse(error: FreeTierLimitError) {
  return {
    status: 403,
    body: error.payload,
  };
}

export function assertFreeTierExpensesAllowed(tier: TierKey | string): void {
  if (!isFreeTier(tier)) return;
  throw new FreeTierLimitError({
    error: "free_tier_limit",
    limit: "expenses",
    message: "Track expenses on Basic (RM39) or Solo (RM79).",
    upgrade_tier: "basic",
  });
}

export function assertFreeTierQuotesAllowed(tier: TierKey | string): void {
  if (!isFreeTier(tier)) return;
  throw new FreeTierLimitError({
    error: "free_tier_limit",
    limit: "quotes",
    message: "Quotes are available on paid plans.",
    upgrade_tier: "basic",
  });
}

export function assertFreeTierDuitNowAllowed(
  tier: TierKey | string,
  showDuitnow?: boolean,
): void {
  if (!isFreeTier(tier) || !showDuitnow) return;
  throw new FreeTierLimitError({
    error: "free_tier_limit",
    limit: "duitnow",
    message: "Add payment QR on paid plans.",
    upgrade_tier: "basic",
  });
}

export async function countFinanceInvoicesThisMonth(
  supabase: SupabaseClient,
  businessId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .is("deleted_at", null)
    .gte("created_at", monthStartIso());

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function assertFreeTierInvoiceQuota(
  supabase: SupabaseClient,
  businessId: string,
  tier: TierKey | string,
): Promise<void> {
  if (!isFreeTier(tier)) return;
  const count = await countFinanceInvoicesThisMonth(supabase, businessId);
  if (count >= FREE_TIER_INVOICES_PER_MONTH) {
    throw new FreeTierLimitError({
      error: "free_tier_limit",
      limit: "invoices",
      message: `You've used ${FREE_TIER_INVOICES_PER_MONTH}/${FREE_TIER_INVOICES_PER_MONTH} invoices this month.`,
      upgrade_tier: "basic",
      current: count,
      max: FREE_TIER_INVOICES_PER_MONTH,
    });
  }
}

export async function countSavedCustomers(
  supabase: SupabaseClient,
  businessId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("merged_into_id", null)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function assertFreeTierCustomerQuota(
  supabase: SupabaseClient,
  businessId: string,
  tier: TierKey | string,
): Promise<void> {
  if (!isFreeTier(tier)) return;
  const count = await countSavedCustomers(supabase, businessId);
  if (count >= FREE_TIER_CUSTOMERS_MAX) {
    throw new FreeTierLimitError({
      error: "free_tier_limit",
      limit: "customers",
      message: `You've saved ${FREE_TIER_CUSTOMERS_MAX}/${FREE_TIER_CUSTOMERS_MAX} customers — upgrade for more.`,
      upgrade_tier: "basic",
      current: count,
      max: FREE_TIER_CUSTOMERS_MAX,
    });
  }
}

export async function incrementFreeTierEmailUsage(
  supabase: SupabaseClient,
  businessId: string,
  tier: TierKey | string,
): Promise<void> {
  const { recordOutboundEmailSend } = await import(
    "@/lib/settings/email-usage-metering"
  );
  await recordOutboundEmailSend(supabase, businessId, tier);
}

export function customerQuotaForTier(tier: TierKey | string): number {
  const def = tierBy(tier);
  return def?.quotas.customers ?? 0;
}

export function isFreeTierLimitError(error: unknown): error is FreeTierLimitError {
  return error instanceof FreeTierLimitError;
}
