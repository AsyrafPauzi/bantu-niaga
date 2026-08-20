import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  billplzCallbackUrl,
  createBillplzBill,
} from "@/lib/integrations/billplz";
import { invoiceShareUrl } from "@/lib/finance/schemas";
import {
  isFinanceBillplzCheckoutEnabled,
  isFinanceBillplzWebhookEnabled,
} from "@/lib/finance/billplz-config";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PublicFinanceInvoice } from "@/lib/finance/public-invoice";

export {
  isFinanceBillplzCheckoutEnabled,
  isFinanceBillplzWebhookEnabled,
} from "@/lib/finance/billplz-config";

export interface FinanceBillplzCheckoutResult {
  configured: boolean;
  checkout_url?: string;
  billplz_id?: string;
  pending?: boolean;
  message?: string;
}

function resolvePayerEmail(
  invoice: PublicFinanceInvoice & { customer_email?: string | null },
): string {
  const email = invoice.customer_email?.trim();
  if (email && email.includes("@")) return email;
  return "payments@customer.local";
}

export async function createFinanceInvoiceBillplzCheckout(
  invoice: PublicFinanceInvoice & { customer_email?: string | null },
  idcompany: string,
): Promise<FinanceBillplzCheckoutResult> {
  if (!isFinanceBillplzCheckoutEnabled()) {
    return {
      configured: false,
      message:
        "Online payment is not live yet. Pay via DuitNow or ask the business to enable Billplz.",
    };
  }

  if (invoice.document_kind === "quote") {
    return { configured: true, message: "Quotes cannot be paid online." };
  }

  if (invoice.status === "paid" || invoice.status === "void") {
    return { configured: true, message: "This invoice is already closed." };
  }

  const admin = createServiceRoleClient();

  const { data: pending } = await admin
    .from("finance_billplz_intents")
    .select("billplz_id, billplz_url, status")
    .eq("finance_invoice_id", invoice.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending?.billplz_url) {
    return {
      configured: true,
      checkout_url: pending.billplz_url,
      billplz_id: pending.billplz_id,
      pending: true,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const collectionId = process.env.BILLPLZ_COLLECTION_ID!.trim();
  const amountCents = Math.round(Number(invoice.total_myr) * 100);

  if (amountCents < 100) {
    return {
      configured: true,
      message: "Minimum online payment is RM 1.00.",
    };
  }

  const bill = await createBillplzBill({
    collectionId,
    email: resolvePayerEmail(invoice),
    name: invoice.customer_name || "Customer",
    amountCents,
    description: `Invoice ${invoice.number} — ${invoice.business.name}`,
    callbackUrl: billplzCallbackUrl(),
    redirectUrl: appUrl
      ? `${invoiceShareUrl(appUrl, idcompany, invoice.share_hash)}?paid=1`
      : undefined,
    reference1: invoice.id,
    reference2: invoice.business.id,
  });

  const { error: intentErr } = await admin.from("finance_billplz_intents").insert({
    business_id: invoice.business.id,
    finance_invoice_id: invoice.id,
    billplz_id: bill.id,
    billplz_url: bill.url,
    amount_myr: Number(invoice.total_myr),
    status: "pending",
  });

  if (intentErr) {
    throw new Error(intentErr.message);
  }

  if (invoice.status === "draft") {
    await admin
      .from("finance_invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", invoice.id)
      .eq("business_id", invoice.business.id);
  }

  return {
    configured: true,
    checkout_url: bill.url,
    billplz_id: bill.id,
    pending: true,
  };
}

export type BillplzCompleteResult =
  | { kind: "finance"; businessId: string; invoiceId: string }
  | { kind: "topup" }
  | { kind: "subscription"; businessId: string; tier: string };

/** Webhook dispatcher — finance invoice, then top-up, then subscription. */
export async function completeBillplzPayment(
  billplzId: string,
  admin?: SupabaseClient,
): Promise<BillplzCompleteResult> {
  const client = admin ?? createServiceRoleClient();

  const financeRes = await client.rpc("finance_complete_billplz", {
    p_billplz_id: billplzId,
  });

  if (!financeRes.error) {
    const row = Array.isArray(financeRes.data)
      ? financeRes.data[0]
      : financeRes.data;
    if (
      row &&
      typeof row === "object" &&
      "business_id" in row &&
      "finance_invoice_id" in row
    ) {
      return {
        kind: "finance",
        businessId: row.business_id as string,
        invoiceId: row.finance_invoice_id as string,
      };
    }
    throw new Error("finance_complete_billplz returned no row");
  }

  if (!financeRes.error.message.includes("not found")) {
    throw new Error(financeRes.error.message);
  }

  const topupRes = await client.rpc("settings_complete_topup_billplz", {
    p_billplz_id: billplzId,
  });

  if (!topupRes.error) {
    return { kind: "topup" };
  }

  if (!topupRes.error.message.includes("not found")) {
    throw new Error(topupRes.error.message);
  }

  const subRes = await client.rpc("settings_complete_subscription_billplz", {
    p_billplz_id: billplzId,
  });

  if (subRes.error) {
    throw new Error(subRes.error.message);
  }

  const subRow = Array.isArray(subRes.data) ? subRes.data[0] : subRes.data;
  if (
    subRow &&
    typeof subRow === "object" &&
    "business_id" in subRow &&
    "tier" in subRow
  ) {
    return {
      kind: "subscription",
      businessId: subRow.business_id as string,
      tier: String(subRow.tier),
    };
  }

  throw new Error("settings_complete_subscription_billplz returned no row");
}
