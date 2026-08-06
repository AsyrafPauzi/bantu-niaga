import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { ZodError } from "zod";
import { resolveAdminFileIdPatch } from "@/lib/admin/validate-admin-file";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import {
  operationsServiceUpdateSchema,
  type OperationsServiceRow,
} from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

const SERVICE_SELECT =
  "id, business_id, name, description, duration_minutes, price_myr, " +
  "is_active, notes, image_file_id, created_by, created_at, updated_at";

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
    parsed = operationsServiceUpdateSchema.parse(body);
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

  const { data, error } = await supabase
    .from("operations_services")
    .update(updatePayload)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(SERVICE_SELECT)
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
                ? "duplicate_name"
                : "update_failed",
          message:
            status === 404
              ? "Service not found."
              : status === 409
                ? "A service with that name already exists."
                : "Could not complete request.",
        },
      },
      { status },
    );
  }

  return NextResponse.json(
    { ok: true, data: data as unknown as OperationsServiceRow },
    { status: 200 },
  );
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
    .from("operations_services")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return dbErrorResponse("delete_failed", error, "operations.api.delete_failed");
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
