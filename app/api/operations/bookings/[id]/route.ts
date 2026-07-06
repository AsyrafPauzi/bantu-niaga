import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import { operationsBookingUpdateSchema } from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

const BOOKING_SELECT =
  "id, business_id, number, resource_id, customer_name, customer_phone, " +
  "service_title, starts_at, ends_at, status, amount_myr, notes, completed_at, " +
  "created_by, created_at, updated_at";

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
    parsed = operationsBookingUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  if (
    parsed.starts_at &&
    parsed.ends_at &&
    new Date(parsed.ends_at) <= new Date(parsed.starts_at)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "validation_failed",
          message: "End time must be after start time.",
        },
      },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = { ...parsed };
  if (parsed.status === "completed") {
    patch.completed_at = new Date().toISOString();
  } else if (
    parsed.status === "held" ||
    parsed.status === "confirmed" ||
    parsed.status === "cancelled"
  ) {
    patch.completed_at = null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_bookings")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(BOOKING_SELECT)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: status === 404 ? "not_found" : "update_failed",
          message: status === 404 ? "Booking not found." : error.message,
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
    .from("operations_bookings")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
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
