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
import { computeFinanceMonthSummary } from "@/lib/finance/helpers";
import {
  financeTransactionCreateSchema,
  type FinanceTransactionRow,
} from "@/lib/finance/schemas";
import { resolveAdminFileIdPatch } from "@/lib/admin/validate-admin-file";
import { notifyFinanceTransactionCreated } from "@/lib/finance/notify";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const month = url.searchParams.get("month") ?? undefined;
  const summaryOnly = url.searchParams.get("summary") === "1";

  const admin = createServiceRoleClient();
  const summary = await computeFinanceMonthSummary(
    admin,
    user.businessId,
    month,
  );

  if (summaryOnly) {
    return NextResponse.json({ ok: true, data: { summary } }, { status: 200 });
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("finance_transactions")
    .select(
      "id, business_id, kind, amount_myr, category, description, counterparty, " +
        "payment_method, txn_date, finance_invoice_id, admin_file_id, created_by, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (kind === "income" || kind === "expense") {
    query = query.eq("kind", kind);
  }

  if (month) {
    const { start, end } = (() => {
      const [y, m] = month.split("-").map(Number);
      const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const endD = new Date(y, m, 0);
      const endDate = `${y}-${String(m).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
      return { start: startDate, end: endDate };
    })();
    query = query.gte("txn_date", start).lte("txn_date", end);
  }

  const { data, error } = await query;
  if (error) {
    return dbErrorResponse("list_failed", error, "finance.api.list_failed", { route: "list_failed" });
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        summary,
        transactions: (data ?? []) as unknown as FinanceTransactionRow[],
      },
    },
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
    parsed = financeTransactionCreateSchema.parse(body);
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

  const { data, error } = await supabase
    .from("finance_transactions")
    .insert({
      business_id: user.businessId,
      kind: parsed.kind,
      amount_myr: parsed.amount_myr,
      category: parsed.category ?? null,
      description: parsed.description,
      counterparty: parsed.counterparty ?? null,
      payment_method: parsed.payment_method ?? null,
      txn_date: parsed.txn_date ?? new Date().toISOString().slice(0, 10),
      admin_file_id: adminFileId,
      operations_order_id: parsed.operations_order_id ?? null,
      created_by: user.id,
    })
    .select(
      "id, business_id, kind, amount_myr, category, description, counterparty, " +
        "payment_method, txn_date, finance_invoice_id, admin_file_id, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    return dbErrorResponse("create_failed", error, "finance.api.create_failed", { route: "create_failed" });
  }

  const row = data as unknown as {
    id: string;
    kind: "income" | "expense";
    description: string;
    amount_myr: number;
  };
  notifyFinanceTransactionCreated({
    businessId: user.businessId,
    kind: row.kind,
    description: row.description,
    amountMyr: Number(row.amount_myr),
    txnId: row.id,
  });

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
