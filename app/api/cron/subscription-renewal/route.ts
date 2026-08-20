import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { getRequestId, requireCronAuth } from "@/lib/api/require-cron";

import { ok } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isBillplzConfigured } from "@/lib/settings/billing";
import {
  billplzCallbackUrl,
  createBillplzBill,
} from "@/lib/integrations/billplz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/subscription-renewal —
 * Free RM0 invoices + trial expiry + pending paid renewals + past_due + Billplz bills.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const denied = requireCronAuth(request, requestId);
  if (denied) return denied;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("subscription_process_renewals");

  if (error) {
    logger.error("subscription.renewal.cron.failed", {
      error: error.message,
      requestId,
    });
    return dbErrorResponse("rpc_failed", error, "cron.job_failed", { requestId });
  }

  const { data: pastDueMarked, error: pastDueErr } = await admin.rpc(
    "subscription_mark_past_due",
  );
  if (pastDueErr) {
    logger.error("subscription.past_due.cron.failed", {
      error: pastDueErr.message,
      requestId,
    });
    return dbErrorResponse("rpc_failed", pastDueErr, "cron.job_failed", {
      requestId,
    });
  }

  let billsCreated = 0;
  if (isBillplzConfigured()) {
    const { data: pendingInvoices, error: listErr } = await admin
      .from("invoices")
      .select("id, business_id, amount_myr, number")
      .eq("kind", "subscription")
      .eq("status", "pending")
      .gt("amount_myr", 0)
      .order("created_at", { ascending: true })
      .limit(50);

    if (listErr) {
      logger.error("subscription.renewal.list_pending.failed", {
        error: listErr.message,
        requestId,
      });
    } else {
      const collectionId = process.env.BILLPLZ_COLLECTION_ID!.trim();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

      for (const inv of pendingInvoices ?? []) {
        const { data: existing } = await admin
          .from("billplz_payment_intents")
          .select("id")
          .eq("invoice_id", inv.id)
          .eq("status", "pending")
          .maybeSingle();
        if (existing) continue;

        const { data: owner } = await admin
          .from("users")
          .select("id, email, display_name")
          .eq("business_id", inv.business_id)
          .eq("role", "owner")
          .maybeSingle();

        const amountCents = Math.round(Number(inv.amount_myr) * 100);
        if (amountCents < 100) continue;

        try {
          const bill = await createBillplzBill({
            collectionId,
            email: owner?.email ?? "owner@business.local",
            name: owner?.display_name ?? "Business owner",
            amountCents,
            description: `NiagaX subscription renewal — ${inv.number}`,
            callbackUrl: billplzCallbackUrl(),
            redirectUrl: appUrl
              ? `${appUrl}/settings/subscription?paid=1`
              : undefined,
            reference1: inv.business_id,
            reference2: inv.id,
          });

          const { error: attachErr } = await admin.rpc(
            "settings_attach_subscription_billplz",
            {
              p_invoice_id: inv.id,
              p_billplz_id: bill.id,
              p_billplz_url: bill.url,
              p_user_id: owner?.id ?? null,
            },
          );
          if (attachErr) {
            logger.error("subscription.renewal.attach.failed", {
              invoiceId: inv.id,
              error: attachErr.message,
              requestId,
            });
            continue;
          }
          billsCreated += 1;
        } catch (e) {
          logger.error("subscription.renewal.billplz.failed", {
            invoiceId: inv.id,
            error: e instanceof Error ? e.message : "unknown",
            requestId,
          });
        }
      }
    }
  }

  return ok(
    {
      renewed: data ?? 0,
      past_due_marked: pastDueMarked ?? 0,
      bills_created: billsCreated,
    },
    { requestId },
  );
}
