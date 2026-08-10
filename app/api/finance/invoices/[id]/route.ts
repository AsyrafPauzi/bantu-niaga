import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isFinanceInvoiceNumberTaken } from "@/lib/finance/helpers";
import {
  INVOICE_SELECT,
  buildTotalsFromPayload,
  loadInvoiceWithItems,
  replaceInvoiceItems,
  resolveCustomerSnapshot,
} from "@/lib/finance/invoice-db";
import { resolveAdminFileIdPatch, loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { buildInvoiceShareFields } from "@/lib/finance/share-link";
import {
  notifyFinanceInvoicePaid,
  notifyFinanceInvoiceSent,
  notifyFinanceInvoiceVoided,
} from "@/lib/finance/notify";
import { dispatchInvoicePaid } from "@/lib/finance/dispatch-invoice-paid";
import {
  financeInvoiceUpdateSchema,
  type FinanceInvoiceRow,
} from "@/lib/finance/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const invoice = await loadInvoiceWithItems(supabase, user.businessId, id);
  if (!invoice) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Invoice not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, data: invoice }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

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
    parsed = financeInvoiceUpdateSchema.parse(body);
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
  const { data: existing } = await supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Invoice not found." } },
      { status: 404 },
    );
  }

  const current = existing as unknown as FinanceInvoiceRow;
  const patch: Record<string, unknown> = { ...parsed };
  if (parsed.customer_email === "") patch.customer_email = null;

  if (parsed.number !== undefined) {
    const admin = createServiceRoleClient();
    if (parsed.number !== current.number) {
      const taken = await isFinanceInvoiceNumberTaken(
        admin,
        user.businessId,
        parsed.number,
        id,
      );
      if (taken) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "duplicate_number",
              message: `“${parsed.number}” is already used. Pick a different number.`,
            },
          },
          { status: 409 },
        );
      }
    }
  }

  if (parsed.admin_file_id !== undefined) {
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
    patch.admin_file_id = fileCheck.value;
  }

  if (
    parsed.customer_id !== undefined ||
    parsed.customer_name !== undefined ||
    parsed.customer_email !== undefined ||
    parsed.customer_phone !== undefined
  ) {
    const customer = await resolveCustomerSnapshot(
      supabase,
      user.businessId,
      parsed.customer_id ?? current.customer_id,
      {
        customer_name: parsed.customer_name ?? current.customer_name,
        customer_email: parsed.customer_email ?? current.customer_email,
        customer_phone: parsed.customer_phone ?? current.customer_phone,
      },
    );
    patch.customer_id = customer.customer_id;
    patch.customer_name = customer.customer_name;
    patch.customer_email = customer.customer_email;
    patch.customer_phone = customer.customer_phone;
    patch.customer_address = customer.customer_address;
  }

  const shouldRecalc =
    parsed.items !== undefined ||
    parsed.amount_myr !== undefined ||
    parsed.discount_myr !== undefined ||
    parsed.discount_pct !== undefined ||
    parsed.tax_myr !== undefined ||
    parsed.tax_pct !== undefined ||
    parsed.shipping_myr !== undefined;

  if (shouldRecalc) {
    const full = await loadInvoiceWithItems(supabase, user.businessId, id);
    const items =
      parsed.items ??
      full?.items?.map((item) => ({
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
        taxable: item.taxable,
        description: item.description,
        unit: item.unit,
        product_id: item.product_id ?? null,
      })) ??
      [];

    const totals = buildTotalsFromPayload({
      items: items.map((item) => ({
        unit_price: item.unit_price,
        quantity: item.quantity,
        taxable: item.taxable,
      })),
      amount_myr: parsed.amount_myr ?? Number(current.amount_myr),
      discount_myr: parsed.discount_myr ?? Number(current.discount_myr),
      discount_pct: parsed.discount_pct ?? Number(current.discount_pct),
      tax_myr: parsed.tax_myr ?? Number(current.tax_myr),
      tax_pct: parsed.tax_pct ?? Number(current.tax_pct),
      shipping_myr: parsed.shipping_myr ?? Number(current.shipping_myr),
    });

    patch.amount_myr = totals.amount_myr;
    patch.discount_myr = totals.discount_myr;
    patch.tax_myr = totals.tax_myr;
    patch.shipping_myr = totals.shipping_myr;
    patch.total_myr = totals.total_myr;
  }

  const now = new Date().toISOString();
  if (parsed.status === "sent") {
    patch.sent_at = now;
    const shareFields = buildInvoiceShareFields("sent");
    patch.share_hash = shareFields.share_hash;
    patch.share_issued_at = shareFields.share_issued_at;
    patch.share_expires_at = shareFields.share_expires_at;
  }
  if (parsed.status === "paid") {
    patch.paid_at = now;
    patch.share_expires_at = null;
  }

  delete patch.items;

  const { data, error } = await supabase
    .from("finance_invoices")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(INVOICE_SELECT)
    .single();

  if (error) {
    return dbErrorResponse("update_failed", error, "finance.api.update_failed", { route: "update_failed" });
  }

  if (parsed.items) {
    try {
      await replaceInvoiceItems(supabase, user.businessId, id, parsed.items);
    } catch (itemErr) {
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

  const row = await loadInvoiceWithItems(supabase, user.businessId, id);
  if (row?.admin_file_id) {
    const names = await loadAdminFileNames(supabase, user.businessId, [
      row.admin_file_id,
    ]);
    row.admin_file_name = names.get(row.admin_file_id) ?? null;
  }
  if (
    parsed.number &&
    parsed.number !== current.number &&
    row
  ) {
    const admin = createServiceRoleClient();
    await admin
      .from("finance_transactions")
      .update({ description: `Payment for ${row.number}` })
      .eq("business_id", user.businessId)
      .eq("finance_invoice_id", id)
      .is("deleted_at", null);
  }
  if (
    parsed.status === "paid" &&
    row &&
    current.status !== "paid"
  ) {
    try {
      await dispatchInvoicePaid({
        supabase,
        invoice: row,
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

  if (row && parsed.status && parsed.status !== current.status) {
    if (
      parsed.status === "sent" &&
      row.document_kind === "invoice"
    ) {
      notifyFinanceInvoiceSent({
        businessId: user.businessId,
        invoiceId: row.id,
        number: row.number,
        customerName: row.customer_name,
        totalMyr: Number(row.total_myr),
      });
    }
    if (parsed.status === "paid" && row.document_kind === "invoice") {
      notifyFinanceInvoicePaid({
        businessId: user.businessId,
        invoiceId: row.id,
        number: row.number,
        customerName: row.customer_name,
        totalMyr: Number(row.total_myr),
      });
    }
    if (parsed.status === "void") {
      notifyFinanceInvoiceVoided({
        businessId: user.businessId,
        invoiceId: row.id,
        number: row.number,
      });
    }
  }

  return NextResponse.json({ ok: true, data: row ?? data }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("finance_invoices")
    .select("number")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  const { error } = await supabase
    .from("finance_invoices")
    .update({ deleted_at: new Date().toISOString(), status: "void" })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return dbErrorResponse("delete_failed", error, "finance.api.delete_failed", { route: "delete_failed" });
  }

  if (existing?.number) {
    notifyFinanceInvoiceVoided({
      businessId: user.businessId,
      invoiceId: id,
      number: existing.number as string,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
