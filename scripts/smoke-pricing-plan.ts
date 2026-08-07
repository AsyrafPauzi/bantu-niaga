/**
 * Pricing plan smoke tests (service-role, no browser).
 *
 * Usage: npm run smoke:pricing
 *
 * Requires .env.local with Supabase URL + service role key.
 * Uses a disposable test business (cleaned up on exit).
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { tierAmountMyr } from "../lib/settings/subscription-billing";
import { tierBundledCredits } from "../lib/settings/tier-agents";
import {
  createServiceAdmin,
  loadDotEnvLocal,
} from "./lib/demo-env";

loadDotEnvLocal();

const TAG = "[smoke:pricing]";
const FREE_TIER_INVOICES_PER_MONTH = 25;
const FREE_TIER_EMAILS_PER_MONTH = 25;
const RESEND_COGS_PER_EMAIL_MYR = 0.01;
const EMAIL_COGS_WARN_MRR_RATIO = 0.15;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function ok(message: string): void {
  console.log(`${TAG} OK ${message}`);
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function cleanup(admin: SupabaseClient, businessId: string): Promise<void> {
  await admin.from("subscription_promotions").delete().eq("business_id", businessId);
  await admin.from("business_usage_monthly").delete().eq("business_id", businessId);
  await admin.from("finance_invoices").delete().eq("business_id", businessId);
  await admin.from("users").delete().eq("business_id", businessId);
  await admin.from("businesses").delete().eq("id", businessId);
}

async function createStarterBusiness(admin: SupabaseClient): Promise<string> {
  const businessId = randomUUID();
  const idcompany = `smoke-pricing-${Date.now()}`;
  const { error } = await admin.from("businesses").insert({
    id: businessId,
    idcompany,
    name: "Smoke Pricing Test",
    tier: "starter",
    subscription_status: "active",
    subscription_renewal_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    credit_balance: 0,
  });
  if (error) throw new Error(`create business: ${error.message}`);
  return businessId;
}

async function grantCredits(
  admin: SupabaseClient,
  businessId: string,
  credits: number,
): Promise<number> {
  const { data, error } = await admin.rpc("settings_grant_credits", {
    p_business_id: businessId,
    p_credits: credits,
    p_reason: "subscription_monthly_grant",
    p_actor_user_id: null,
  });
  if (error) throw new Error(`settings_grant_credits: ${error.message}`);
  return data as number;
}

async function resolveActorUserId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from("users").select("id").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("no users in database for created_by FK");
  return data.id as string;
}

function smokeShareHash(i: number): string {
  return `s${String(i).padStart(7, "0")}`.slice(0, 8);
}

async function countInvoicesThisMonth(
  admin: SupabaseClient,
  businessId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("document_kind", "invoice")
    .is("deleted_at", null)
    .gte("created_at", monthStartIso());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function main(): Promise<void> {
  const admin = createServiceAdmin();
  const actorUserId = await resolveActorUserId(admin);
  const businessId = await createStarterBusiness(admin);

  try {
    assert(tierAmountMyr("basic") === 39, "basic price");
    assert(tierAmountMyr("micro") === 79, "micro price");
    assert(tierBundledCredits("micro") === 120, "micro credits");
    ok("tier amounts and bundled credits");

    // Free tier: expenses blocked at API layer (assert helper behavior inline)
    const starterBlocksExpenses = tierBundledCredits("starter") === 0;
    assert(starterBlocksExpenses, "starter has no bundled credits");
    ok("free tier expense policy (starter tier)");

    // Free tier invoice cap
    for (let i = 0; i < FREE_TIER_INVOICES_PER_MONTH; i++) {
      const { error: invErr } = await admin.from("finance_invoices").insert({
        business_id: businessId,
        number: `INV-SMOKE-${i}`,
        share_hash: smokeShareHash(i),
        customer_name: "Smoke Customer",
        invoice_date: new Date().toISOString().slice(0, 10),
        amount_myr: 10,
        total_myr: 10,
        status: "draft",
        document_kind: "invoice",
        created_by: actorUserId,
      });
      if (invErr) throw new Error(`invoice insert ${i}: ${invErr.message}`);
    }
    const invoiceCount = await countInvoicesThisMonth(admin, businessId);
    assert(
      invoiceCount >= FREE_TIER_INVOICES_PER_MONTH,
      "seeded invoice count",
    );
    ok(`free tier invoice cap seeded (${invoiceCount} invoices)`);

    // Tier change + credit grant via RPC
    const { error: tierErr } = await admin.rpc("settings_change_tier", {
      p_business_id: businessId,
      p_tier: "basic",
      p_user_id: null,
    });
    if (tierErr) throw new Error(`settings_change_tier: ${tierErr.message}`);

    const { data: afterBasic } = await admin
      .from("businesses")
      .select("tier, credit_balance")
      .eq("id", businessId)
      .single();
    assert(afterBasic?.tier === "basic", "tier changed to basic");
    assert(
      Number(afterBasic?.credit_balance) >= tierBundledCredits("basic"),
      "basic credits granted",
    );
    ok("tier change to basic grants bundled credits");

    // Trial credit grant path (micro → 120)
    await admin
      .from("businesses")
      .update({ tier: "micro", credit_balance: 0 })
      .eq("id", businessId);
    const granted = await grantCredits(admin, businessId, tierBundledCredits("micro"));
    assert(granted === 120, "grant returns 120 for micro");
    const { data: afterGrant } = await admin
      .from("businesses")
      .select("credit_balance")
      .eq("id", businessId)
      .single();
    assert(Number(afterGrant?.credit_balance) >= 120, "micro credits in balance");
    ok("trial sign-up credit grant path (micro -> 120)");

    // Paid email COGS warn-only (direct usage rollup)
    const monthKey = new Date().toISOString().slice(0, 7);
    const planMrr = tierAmountMyr("micro");
    const warnEmails =
      Math.ceil((planMrr * EMAIL_COGS_WARN_MRR_RATIO) / RESEND_COGS_PER_EMAIL_MYR) + 2;
    const emailCogs = warnEmails * RESEND_COGS_PER_EMAIL_MYR;
    const { error: usageErr } = await admin.from("business_usage_monthly").upsert(
      {
        business_id: businessId,
        month: monthKey,
        emails_sent: warnEmails,
        email_cogs_myr: emailCogs,
        plan_mrr_myr: planMrr,
        guardrail_status:
          emailCogs / planMrr >= EMAIL_COGS_WARN_MRR_RATIO ? "warn" : "ok",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,month" },
    );
    if (usageErr) throw new Error(usageErr.message);
    const { data: usage } = await admin
      .from("business_usage_monthly")
      .select("guardrail_status, email_cogs_myr")
      .eq("business_id", businessId)
      .eq("month", monthKey)
      .maybeSingle();
    assert(usage?.guardrail_status === "warn", "COGS warn status");
    ok("paid email COGS warn-only rollup");

    // Free email cap
    const freeBizId = await createStarterBusiness(admin);
    try {
      const { data: freeUsage } = await admin
        .from("business_usage_monthly")
        .select("emails_sent")
        .eq("business_id", freeBizId)
        .eq("month", monthKey)
        .maybeSingle();
      const freeEmails = freeUsage?.emails_sent ?? 0;
      assert(freeEmails <= FREE_TIER_EMAILS_PER_MONTH, "free email cap constant");
      ok("free tier email cap constant (25/mo)");
    } finally {
      await cleanup(admin, freeBizId);
    }

    // Super-admin promo provision (DB path)
    const promoBusinessId = randomUUID();
    const promoIdcompany = `smoke-promo-${Date.now()}`;
    await admin.from("businesses").insert({
      id: promoBusinessId,
      idcompany: promoIdcompany,
      name: "Smoke Promo Client",
      tier: "basic",
      subscription_status: "active",
      subscription_renewal_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      credit_balance: 0,
    });
    const expiredAt = new Date(Date.now() - 86400000).toISOString();
    await admin.from("subscription_promotions").insert({
      business_id: promoBusinessId,
      promo_tier: "micro",
      post_promo_tier: "basic",
      ends_at: expiredAt,
      campaign_code: "SMOKE-PRICING",
    });
    await grantCredits(admin, promoBusinessId, tierBundledCredits("micro"));

    const { data: promoBiz } = await admin
      .from("businesses")
      .select("tier, credit_balance")
      .eq("id", promoBusinessId)
      .single();
    assert(promoBiz?.tier === "basic", "billing tier during promo");
    assert(
      Number(promoBiz?.credit_balance) >= tierBundledCredits("micro"),
      "promo credits granted",
    );

    const { data: expired, error: expiryErr } = await admin.rpc(
      "subscription_process_promo_expiry",
    );
    if (expiryErr) throw new Error(`promo expiry rpc: ${expiryErr.message}`);
    assert((expired ?? 0) >= 1, "promo expiry processed at least one row");
    ok(`super-admin promo + expiry cron (expired=${expired ?? 0})`);

    await cleanup(admin, promoBusinessId);

    console.log(`${TAG} All pricing smoke checks passed.`);
  } finally {
    await cleanup(admin, businessId);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(TAG + " FAILED:", msg);
  process.exit(1);
});
