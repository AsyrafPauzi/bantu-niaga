import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { requireFinanceUser } from "@/lib/finance/require-user";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  generateShareHash,
  nextFinanceInvoiceNumber,
} from "@/lib/finance/helpers";
import {
  INVOICE_SELECT,
  loadInvoiceWithItems,
  replaceInvoiceItems,
} from "@/lib/finance/invoice-db";
import type { FinanceInvoiceRow } from "@/lib/finance/schemas";
import { notifyFinanceQuoteConverted } from "@/lib/finance/notify";
import {
  assertFreeTierInvoiceQuota,
  isFreeTierLimitError,
} from "@/lib/settings/free-tier-limits";
import { loadBusinessTier } from "@/lib/settings/load-business-tier";

export const dynamic = "force-dynamic";

/** POST /api/finance/invoices/[id]/convert-to-invoice — copy quote to invoice. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  let dueDateOverride: string | null | undefined;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && "due_date" in body) {
      const raw = (body as { due_date?: unknown }).due_date;
      if (raw === null || raw === "") dueDateOverride = null;
      else if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        dueDateOverride = raw;
      }
    }
  } catch {
    // empty body is fine
  }

  const supabase = await createSupabaseServerClient();
  const quote = await loadInvoiceWithItems(supabase, user.businessId, id);

  if (!quote) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Quote not found." } },
      { status: 404 },
    );
  }

  if (quote.document_kind !== "quote") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "not_a_quote",
          message: "Only quotes can be converted to invoices.",
        },
      },
      { status: 400 },
    );
  }

  const tier = await loadBusinessTier(user.businessId, supabase);
  try {
    await assertFreeTierInvoiceQuota(supabase, user.businessId, tier);
  } catch (e) {
    if (isFreeTierLimitError(e)) {
      return NextResponse.json(
        { ok: false, error: e.payload },
        { status: 403 },
      );
    }
    throw e;
  }

  const admin = createServiceRoleClient();
  const number = await nextFinanceInvoiceNumber(admin, user.businessId, "INV");
  const shareHash = generateShareHash();
  const now = new Date().toISOString();
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);
  const dueDate =
    dueDateOverride !== undefined
      ? dueDateOverride
      : quote.due_date ??
        defaultDue.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("finance_invoices")
    .insert({
      business_id: user.businessId,
      number,
      share_hash: shareHash,
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      customer_email: quote.customer_email,
      customer_phone: quote.customer_phone,
      title: quote.title,
      description: quote.description,
      invoice_date: quote.invoice_date,
      amount_myr: quote.amount_myr,
      discount_myr: quote.discount_myr,
      discount_pct: quote.discount_pct,
      tax_myr: quote.tax_myr,
      tax_pct: quote.tax_pct,
      shipping_myr: quote.shipping_myr,
      total_myr: quote.total_myr,
      status: "draft",
      due_date: dueDate,
      notes: quote.notes,
      document_kind: "invoice",
      show_duitnow: quote.show_duitnow,
      admin_file_id: quote.admin_file_id ?? null,
      converted_from_id: quote.id,
      created_by: user.id,
    })
    .select(INVOICE_SELECT)
    .single();

  if (error) {
    return dbErrorResponse("create_failed", error, "finance.api.create_failed", { route: "create_failed" });
  }

  const row = data as unknown as FinanceInvoiceRow;

  if (quote.items && quote.items.length > 0) {
    try {
      await replaceInvoiceItems(
        supabase,
        user.businessId,
        row.id,
        quote.items.map((item) => ({
          description: item.description,
          unit_price: Number(item.unit_price),
          quantity: Number(item.quantity),
          unit: item.unit,
          taxable: item.taxable,
        })),
      );
    } catch (itemErr) {
      await supabase
        .from("finance_invoices")
        .update({ deleted_at: now, status: "void" })
        .eq("id", row.id);
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "items_failed",
            message:
              itemErr instanceof Error ? itemErr.message : "Could not copy items.",
          },
        },
        { status: 500 },
      );
    }
  }

  const full = await loadInvoiceWithItems(supabase, user.businessId, row.id);

  notifyFinanceQuoteConverted({
    businessId: user.businessId,
    quoteNumber: quote.number,
    invoiceId: row.id,
    invoiceNumber: row.number,
    customerName: quote.customer_name,
  });

  return NextResponse.json({ ok: true, data: full ?? row }, { status: 201 });
}
