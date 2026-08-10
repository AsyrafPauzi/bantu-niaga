import { enforceRateLimit } from "@/lib/api/enforce-rate-limit";
import { dbErrorResponse } from "@/lib/api/db-error";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buildInvoiceShareFields } from "@/lib/finance/share-link";
import {
  isFinanceInvoiceNumberTaken,
  nextFinanceInvoiceNumber,
} from "@/lib/finance/helpers";
import {
  INVOICE_SELECT,
  buildTotalsFromPayload,
  loadInvoiceWithItems,
  replaceInvoiceItems,
  resolveCustomerSnapshot,
} from "@/lib/finance/invoice-db";
import { resolveAdminFileIdPatch } from "@/lib/admin/validate-admin-file";
import {
  notifyFinanceInvoiceCreated,
  notifyFinanceInvoicePaid,
  notifyFinanceInvoiceSent,
} from "@/lib/finance/notify";
import { dispatchInvoicePaid } from "@/lib/finance/dispatch-invoice-paid";
import {
  financeInvoiceCreateSchema,
  type FinanceInvoiceRow,
} from "@/lib/finance/schemas";
import {
  assertFreeTierDuitNowAllowed,
  assertFreeTierInvoiceQuota,
  assertFreeTierQuotesAllowed,
  isFreeTierLimitError,
} from "@/lib/settings/free-tier-limits";
import { loadBusinessTier } from "@/lib/settings/load-business-tier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  const documentKind =
    kindParam === "quote" || kindParam === "invoice" ? kindParam : null;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (documentKind) {
    query = query.eq("document_kind", documentKind);
  }

  const { data, error } = await query;

  if (error) {
    return dbErrorResponse("list_failed", error, "finance.api.list_failed", { route: "list_failed" });
  }

  return NextResponse.json(
    { ok: true, data: data ?? [] },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const limited = enforceRateLimit({
    bucket: "finance.invoices.create",
    identifier: `user:${user.id}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = financeInvoiceCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const tier = await loadBusinessTier(user.businessId, supabase);

  try {
    const documentKind = parsed.document_kind ?? "invoice";
    if (documentKind === "quote") {
      assertFreeTierQuotesAllowed(tier);
    } else {
      await assertFreeTierInvoiceQuota(supabase, user.businessId, tier);
    }
    assertFreeTierDuitNowAllowed(tier, parsed.show_duitnow);
  } catch (e) {
    if (isFreeTierLimitError(e)) {
      return NextResponse.json(
        { ok: false, error: e.payload },
        { status: 403 },
      );
    }
    throw e;
  }

  if (tier === "starter" && parsed.show_duitnow) {
    parsed = { ...parsed, show_duitnow: false };
  }
  const customer = await resolveCustomerSnapshot(
    supabase,
    user.businessId,
    parsed.customer_id,
    {
      customer_name: parsed.customer_name,
      customer_email: parsed.customer_email,
      customer_phone: parsed.customer_phone,
    },
  );

  if (!customer.customer_name) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "validation_failed", message: "Customer is required." },
      },
      { status: 400 },
    );
  }

  const totals = buildTotalsFromPayload(parsed);
  const admin = createServiceRoleClient();
  const documentKind = parsed.document_kind ?? "invoice";
  const prefix = documentKind === "quote" ? "QUO" : "INV";
  let number =
    parsed.number ??
    (await nextFinanceInvoiceNumber(admin, user.businessId, prefix));

  if (parsed.number) {
    const taken = await isFinanceInvoiceNumberTaken(
      admin,
      user.businessId,
      number,
    );
    if (taken) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "duplicate_number",
            message: `“${number}” is already used. Pick a different number.`,
          },
        },
        { status: 409 },
      );
    }
  }
  const now = new Date().toISOString();
  const status = parsed.status ?? "draft";
  const shareFields = buildInvoiceShareFields(status);
  const invoiceDate =
    parsed.invoice_date ?? new Date().toISOString().slice(0, 10);

  let adminFileId: string | null = null;
  if (parsed.admin_file_id) {
    const fileCheck = await resolveAdminFileIdPatch(
      supabase,
      user.businessId,
      parsed.admin_file_id,
    );
    if (!fileCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "invalid_file", message: fileCheck.message },
        },
        { status: 400 },
      );
    }
    adminFileId = fileCheck.value;
  }

  if (parsed.sales_lead_id) {
    const { data: leadRow } = await supabase
      .from("sales_leads")
      .select("id")
      .eq("business_id", user.businessId)
      .eq("id", parsed.sales_lead_id)
      .maybeSingle();
    if (!leadRow) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "invalid_lead", message: "Lead not found." },
        },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("finance_invoices")
    .insert({
      business_id: user.businessId,
      number,
      share_hash: shareFields.share_hash,
      share_issued_at: shareFields.share_issued_at,
      share_expires_at: shareFields.share_expires_at,
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      customer_email: customer.customer_email,
      customer_phone: customer.customer_phone,
      customer_address: customer.customer_address,
      title: parsed.title ?? null,
      description: parsed.description ?? null,
      invoice_date: invoiceDate,
      amount_myr: totals.amount_myr,
      discount_myr: totals.discount_myr,
      discount_pct: parsed.discount_pct ?? 0,
      tax_myr: totals.tax_myr,
      tax_pct: parsed.tax_pct ?? 0,
      shipping_myr: totals.shipping_myr,
      total_myr: totals.total_myr,
      status,
      due_date: parsed.due_date ?? null,
      notes: parsed.notes ?? null,
      document_kind: documentKind,
      show_duitnow: parsed.show_duitnow ?? true,
      admin_file_id: adminFileId,
      sales_lead_id: parsed.sales_lead_id ?? null,
      sent_at: status === "sent" ? now : null,
      paid_at: status === "paid" ? now : null,
      created_by: user.id,
    })
    .select(INVOICE_SELECT)
    .single();

  if (error) {
    return dbErrorResponse("create_failed", error, "finance.api.create_failed", { route: "create_failed" });
  }

  const row = data as unknown as FinanceInvoiceRow;

  if (parsed.items && parsed.items.length > 0) {
    try {
      await replaceInvoiceItems(
        supabase,
        user.businessId,
        row.id,
        parsed.items,
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
              itemErr instanceof Error ? itemErr.message : "Could not save items.",
          },
        },
        { status: 500 },
      );
    }
  }

  const full = await loadInvoiceWithItems(supabase, user.businessId, row.id);
  if (full?.status === "paid" && full.document_kind === "invoice") {
    try {
      await dispatchInvoicePaid({
        supabase,
        invoice: full,
        userId: user.id,
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "invoice_paid_dispatch_failed",
            message:
              err instanceof Error
                ? err.message
                : "Could not complete cross-pillar sync for paid invoice.",
          },
        },
        { status: 500 },
      );
    }
  }

  const invoiceRow = full ?? row;
  notifyFinanceInvoiceCreated({
    businessId: user.businessId,
    invoiceId: invoiceRow.id,
    number: invoiceRow.number,
    customerName: invoiceRow.customer_name,
    totalMyr: Number(invoiceRow.total_myr),
    documentKind: invoiceRow.document_kind,
    status: invoiceRow.status,
  });
  if (invoiceRow.status === "sent" && invoiceRow.document_kind === "invoice") {
    notifyFinanceInvoiceSent({
      businessId: user.businessId,
      invoiceId: invoiceRow.id,
      number: invoiceRow.number,
      customerName: invoiceRow.customer_name,
      totalMyr: Number(invoiceRow.total_myr),
    });
  }
  if (invoiceRow.status === "paid" && invoiceRow.document_kind === "invoice") {
    notifyFinanceInvoicePaid({
      businessId: user.businessId,
      invoiceId: invoiceRow.id,
      number: invoiceRow.number,
      customerName: invoiceRow.customer_name,
      totalMyr: Number(invoiceRow.total_myr),
    });
  }

  return NextResponse.json({ ok: true, data: invoiceRow }, { status: 201 });
}
