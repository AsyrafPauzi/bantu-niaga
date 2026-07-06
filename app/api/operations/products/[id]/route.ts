import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import { operationsProductUpdateSchema } from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

const PRODUCT_SELECT =
  "id, business_id, sku, name, description, category, price_myr, " +
  "is_active, notes, created_by, created_at, updated_at";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    parsed = operationsProductUpdateSchema.parse(body);
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
    .update(parsed)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(PRODUCT_SELECT)
    .single();

  if (error) {
    const status =
      error.code === "PGRST116" ? 404 : error.code === "23505" ? 409 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code:
            status === 404
              ? "not_found"
              : status === 409
                ? "duplicate_sku"
                : "update_failed",
          message:
            status === 404
              ? "Product not found."
              : status === 409
                ? "That SKU already exists."
                : error.message,
        },
      },
      { status },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("operations_products")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "delete_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
