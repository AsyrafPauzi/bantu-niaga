import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import {
  operationsProductCreateSchema,
  type OperationsProductRow,
} from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

const PRODUCT_SELECT =
  "id, business_id, sku, name, description, category, price_myr, " +
  "is_active, notes, created_by, created_at, updated_at";

export async function GET(request: Request) {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("operations_products")
    .select(PRODUCT_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "list_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, data: (data ?? []) as unknown as OperationsProductRow[] },
    { status: 200 },
  );
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
    parsed = operationsProductCreateSchema.parse(body);
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
    .from("operations_products")
    .insert({
      business_id: user.businessId,
      sku: parsed.sku,
      name: parsed.name,
      description: parsed.description ?? null,
      category: parsed.category ?? null,
      price_myr: parsed.price_myr,
      is_active: parsed.is_active ?? true,
      notes: parsed.notes ?? null,
      created_by: user.id,
    })
    .select(PRODUCT_SELECT)
    .single();

  if (error) {
    const code =
      error.code === "23505" ? "duplicate_sku" : "create_failed";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message:
            code === "duplicate_sku"
              ? "That SKU already exists."
              : error.message,
        },
      },
      { status: code === "duplicate_sku" ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
