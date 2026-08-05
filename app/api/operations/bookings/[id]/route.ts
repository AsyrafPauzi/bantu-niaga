import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import { operationsBookingUpdateSchema } from "@/lib/operations/schemas";
import { notifyOperationsBookingStatusChanged } from "@/lib/operations/notify";

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

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("operations_bookings")
    .select("resource_id, starts_at, ends_at, number, service_title, status")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "Booking not found." },
      },
      { status: 404 },
    );
  }

  const resourceId =
    parsed.resource_id !== undefined
      ? parsed.resource_id
      : (existing.resource_id as string | null);
  const startsAt = parsed.starts_at ?? (existing.starts_at as string);
  const endsAt = parsed.ends_at ?? (existing.ends_at as string);

  if (resourceId && startsAt && endsAt) {
    if (new Date(endsAt) <= new Date(startsAt)) {
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

    const { findBookingConflicts } = await import(
      "@/lib/operations/booking-buffer"
    );
    const conflicts = await findBookingConflicts(supabase, user.businessId, {
      resourceId,
      startsAt,
      endsAt,
      excludeBookingId: id,
    });
    if (conflicts.length > 0) {
      const c = conflicts[0];
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "booking_conflict",
            message: `Slot overlaps ${c.number} (includes ${c.bufferMinutes}m buffer).`,
            conflicts,
          },
        },
        { status: 409 },
      );
    }
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

  const row = data as unknown as {
    number: string;
    service_title: string;
    status: string;
  };
  if (parsed.status && parsed.status !== existing.status) {
    notifyOperationsBookingStatusChanged({
      businessId: user.businessId,
      bookingId: id,
      number: row.number,
      serviceTitle: row.service_title,
      status: row.status,
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
