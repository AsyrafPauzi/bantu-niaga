import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAdminFileIdPatch } from "@/lib/admin/validate-admin-file";
import { requireOperationsUser } from "@/lib/operations/require-user";
import { operationsProductUpdateSchema } from "@/lib/operations/schemas";
import { notifyOperationsProductLowStock } from "@/lib/operations/notify";

export const dynamic = "force-dynamic";

const PRODUCT_SELECT =
  "id, business_id, sku, name, description, category, price_myr, " +
  "is_active, stock_qty, low_stock_threshold, notes, image_file_id, spec_file_id, created_by, created_at, updated_at";

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

  const { data: existing } = await supabase
    .from("operations_products")
    .select("sku, name, stock_qty, low_stock_threshold")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Product not found." } },
      { status: 404 },
    );
  }

  const updatePayload = { ...parsed };
  if (parsed.image_file_id !== undefined) {
    const resolved = await resolveAdminFileIdPatch(
      supabase,
      user.businessId,
      parsed.image_file_id,
    );
    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "invalid_file", message: resolved.message } },
        { status: 400 },
      );
    }
    updatePayload.image_file_id = resolved.value;
  }
  if (parsed.spec_file_id !== undefined) {
    const resolved = await resolveAdminFileIdPatch(
      supabase,
      user.businessId,
      parsed.spec_file_id,
    );
    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "invalid_file", message: resolved.message } },
        { status: 400 },
      );
    }
    updatePayload.spec_file_id = resolved.value;
  }

  const { data, error } = await supabase
    .from("operations_products")
    .update(updatePayload)
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
                : "Could not complete request.",
        },
      },
      { status },
    );
  }

  const row = data as unknown as {
    sku: string;
    name: string;
    stock_qty: number | null;
    low_stock_threshold: number;
  };
  const prevQty = existing.stock_qty as number | null;
  const prevThreshold = (existing.low_stock_threshold as number) ?? 5;
  const wasLow =
    prevQty !== null && prevQty <= prevThreshold;
  const isLow =
    row.stock_qty !== null && row.stock_qty <= (row.low_stock_threshold ?? 5);
  if (isLow && !wasLow) {
    notifyOperationsProductLowStock({
      businessId: user.businessId,
      productId: id,
      sku: row.sku,
      name: row.name,
      stockQty: row.stock_qty as number,
    });
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
    return dbErrorResponse("delete_failed", error, "operations.api.delete_failed");
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
