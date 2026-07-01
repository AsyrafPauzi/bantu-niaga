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
import { computeFinanceMonthSummary } from "@/lib/finance/helpers";
import {
  financeTransactionCreateSchema,
  type FinanceTransactionRow,
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
            error: {
              code: "forbidden",
              message: "You don't have permission to access Finance.",
            },
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
        "payment_method, txn_date, finance_invoice_id, created_by, created_at, updated_at",
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
    return NextResponse.json(
      { ok: false, error: { code: "list_failed", message: error.message } },
      { status: 500 },
    );
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
      created_by: user.id,
    })
    .select(
      "id, business_id, kind, amount_myr, category, description, counterparty, " +
        "payment_method, txn_date, finance_invoice_id, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "create_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
