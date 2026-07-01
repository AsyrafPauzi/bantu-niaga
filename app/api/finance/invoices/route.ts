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
    .select(
      "id, business_id, number, share_hash, customer_name, customer_email, " +
        "customer_phone, description, amount_myr, tax_myr, total_myr, status, " +
        "due_date, notes, paid_at, sent_at, created_at, updated_at",
    )
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

  const admin = createServiceRoleClient();
  const number = await nextFinanceInvoiceNumber(admin, user.businessId);
  const shareHash = generateShareHash();
  const tax = parsed.tax_myr ?? 0;
  const total = parsed.amount_myr + tax;
  const now = new Date().toISOString();
  const status = parsed.status ?? "draft";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("finance_invoices")
    .insert({
      business_id: user.businessId,
      number,
      share_hash: shareHash,
      customer_name: parsed.customer_name,
      customer_email: parsed.customer_email || null,
      customer_phone: parsed.customer_phone ?? null,
      description: parsed.description ?? null,
      amount_myr: parsed.amount_myr,
      tax_myr: tax,
      total_myr: total,
      status,
      due_date: parsed.due_date ?? null,
      notes: parsed.notes ?? null,
      sent_at: status === "sent" ? now : null,
      paid_at: status === "paid" ? now : null,
      created_by: user.id,
    })
    .select(
      "id, business_id, number, share_hash, customer_name, customer_email, " +
        "customer_phone, description, amount_myr, tax_myr, total_myr, status, " +
        "due_date, notes, paid_at, sent_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "create_failed", message: error.message } },
      { status: 500 },
    );
  }

  const row = data as unknown as FinanceInvoiceRow;
  if (row.status === "paid") {
    await recordInvoiceIncome(admin, user.businessId, user.id, row);
  }

  return NextResponse.json({ ok: true, data: row }, { status: 201 });
}
