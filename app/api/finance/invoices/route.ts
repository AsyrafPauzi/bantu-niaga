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
  generateShareHash,
  nextFinanceInvoiceNumber,
} from "@/lib/finance/helpers";
import {
  INVOICE_SELECT,
  buildTotalsFromPayload,
  loadInvoiceWithItems,
  replaceInvoiceItems,
  resolveCustomerSnapshot,
} from "@/lib/finance/invoice-db";
import {
  financeInvoiceCreateSchema,
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

export async function GET() {
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "list_failed", message: error.message } },
      { status: 500 },
    );
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
  const number = await nextFinanceInvoiceNumber(admin, user.businessId);
  const shareHash = generateShareHash();
  const now = new Date().toISOString();
  const status = parsed.status ?? "draft";
  const invoiceDate =
    parsed.invoice_date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("finance_invoices")
    .insert({
      business_id: user.businessId,
      number,
      share_hash: shareHash,
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      customer_email: customer.customer_email,
      customer_phone: customer.customer_phone,
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
      sent_at: status === "sent" ? now : null,
      paid_at: status === "paid" ? now : null,
      created_by: user.id,
    })
    .select(INVOICE_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "create_failed", message: error.message } },
      { status: 500 },
    );
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
  if (full?.status === "paid") {
    await recordInvoiceIncome(admin, user.businessId, user.id, full);
  }

  return NextResponse.json({ ok: true, data: full ?? row }, { status: 201 });
}
