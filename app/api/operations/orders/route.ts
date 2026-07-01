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
import { nextOperationsOrderNumber } from "@/lib/operations/helpers";
import {
  operationsOrderCreateSchema,
  type OperationsOrderRow,
} from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

async function requireOperationsUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!can(user.role, "operations")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to access Operations.",
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

const ORDER_SELECT =
  "id, business_id, number, customer_name, customer_phone, title, description, " +
  "status, due_date, amount_myr, supplier_id, notes, completed_at, " +
  "created_by, created_at, updated_at";

export async function GET() {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_orders")
    .select(ORDER_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "list_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as OperationsOrderRow[];
  const supplierIds = Array.from(
    new Set(rows.map((r) => r.supplier_id).filter(Boolean)),
  ) as string[];

  const nameLookup = new Map<string, string>();
  if (supplierIds.length > 0) {
    const { data: suppliers } = await supabase
      .from("operations_suppliers")
      .select("id, name")
      .in("id", supplierIds);
    for (const s of (suppliers ?? []) as Array<{ id: string; name: string }>) {
      nameLookup.set(s.id, s.name);
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    supplier_name: r.supplier_id
      ? (nameLookup.get(r.supplier_id) ?? null)
      : null,
  }));

  return NextResponse.json({ ok: true, data: enriched }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_json", message: "Invalid JSON body." },
      },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = operationsOrderCreateSchema.parse(body);
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
  const number = await nextOperationsOrderNumber(admin, user.businessId);
  const completedAt =
    parsed.status === "done" ? new Date().toISOString() : null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_orders")
    .insert({
      business_id: user.businessId,
      number,
      customer_name: parsed.customer_name,
      customer_phone: parsed.customer_phone ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      status: parsed.status ?? "todo",
      due_date: parsed.due_date ?? null,
      amount_myr: parsed.amount_myr ?? null,
      supplier_id: parsed.supplier_id ?? null,
      notes: parsed.notes ?? null,
      completed_at: completedAt,
      created_by: user.id,
    })
    .select(ORDER_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "create_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
