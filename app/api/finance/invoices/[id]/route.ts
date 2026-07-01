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

  const patch: Record<string, unknown> = { ...parsed };
  if (parsed.customer_email === "") patch.customer_email = null;

  if (parsed.amount_myr !== undefined || parsed.tax_myr !== undefined) {
    const supabase = await createSupabaseServerClient();
    const { data: current } = await supabase
      .from("finance_invoices")
      .select("amount_myr, tax_myr")
      .eq("id", id)
      .eq("business_id", user.businessId)
      .maybeSingle();

    const cur = current as { amount_myr: number; tax_myr: number } | null;
    const amount = parsed.amount_myr ?? Number(cur?.amount_myr ?? 0);
    const tax = parsed.tax_myr ?? Number(cur?.tax_myr ?? 0);
    patch.total_myr = amount + tax;
  }

  const now = new Date().toISOString();
  if (parsed.status === "sent") {
    patch.sent_at = now;
  }
  if (parsed.status === "paid") {
    patch.paid_at = now;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("finance_invoices")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(
      "id, business_id, number, share_hash, customer_name, customer_email, " +
        "customer_phone, description, amount_myr, tax_myr, total_myr, status, " +
        "due_date, notes, paid_at, sent_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "update_failed", message: error.message } },
      { status: 500 },
    );
  }

  const row = data as unknown as FinanceInvoiceRow;
  if (parsed.status === "paid") {
    const admin = createServiceRoleClient();
    await recordInvoiceIncome(admin, user.businessId, user.id, row);
  }

  return NextResponse.json({ ok: true, data: row }, { status: 200 });
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
