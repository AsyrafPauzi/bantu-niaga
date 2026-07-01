import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  INVOICE_SELECT,
  buildTotalsFromPayload,
  loadInvoiceWithItems,
  replaceInvoiceItems,
  resolveCustomerSnapshot,
} from "@/lib/finance/invoice-db";
import {
  financeInvoiceUpdateSchema,
  type FinanceInvoiceRow,
} from "@/lib/finance/schemas";

export const dynamic = "force-dynamic";

async function requireFinanceUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!can(user.role, "finance")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "forbidden", message: "Finance access denied." },
          },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "unauthorized", message: "Authentication required." },
          },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

async function recordInvoiceIncome(
  admin: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  userId: string,
  invoice: FinanceInvoiceRow,
): Promise<void> {
  const { data: existing } = await admin
    .from("finance_transactions")
    .select("id")
    .eq("business_id", businessId)
    .eq("finance_invoice_id", invoice.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) return;

  await admin.from("finance_transactions").insert({
    business_id: businessId,
    kind: "income",
    amount_myr: invoice.total_myr,
    category: "invoice_payment",
    description: `Payment for ${invoice.number}`,
    counterparty: invoice.customer_name,
    payment_method: "other",
    txn_date: new Date().toISOString().slice(0, 10),
    finance_invoice_id: invoice.id,
    created_by: userId,
  });
}

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
  if (parsed.status === "sent") patch.sent_at = now;
  if (parsed.status === "paid") patch.paid_at = now;

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
    return NextResponse.json(
      { ok: false, error: { code: "update_failed", message: error.message } },
      { status: 500 },
    );
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
  if (parsed.status === "paid" && row) {
    const admin = createServiceRoleClient();
    await recordInvoiceIncome(admin, user.businessId, user.id, row);
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
  const { error } = await supabase
    .from("finance_invoices")
    .update({ deleted_at: new Date().toISOString(), status: "void" })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "delete_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
