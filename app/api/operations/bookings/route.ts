import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { nextOperationsBookingNumber } from "@/lib/operations/helpers";
import { requireOperationsUser } from "@/lib/operations/require-user";
import {
  operationsBookingCreateSchema,
  type OperationsBookingRow,
} from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

const BOOKING_SELECT =
  "id, business_id, number, resource_id, customer_name, customer_phone, " +
  "service_title, starts_at, ends_at, status, amount_myr, notes, completed_at, " +
  "created_by, created_at, updated_at";

export async function GET() {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_bookings")
    .select(BOOKING_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "list_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as OperationsBookingRow[];
  const resourceIds = Array.from(
    new Set(rows.map((r) => r.resource_id).filter(Boolean)),
  ) as string[];

  const nameLookup = new Map<string, string>();
  if (resourceIds.length > 0) {
    const { data: resources } = await supabase
      .from("operations_booking_resources")
      .select("id, name")
      .in("id", resourceIds);
    for (const r of (resources ?? []) as Array<{ id: string; name: string }>) {
      nameLookup.set(r.id, r.name);
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    resource_name: r.resource_id
      ? (nameLookup.get(r.resource_id) ?? null)
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
    parsed = operationsBookingCreateSchema.parse(body);
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
  const number = await nextOperationsBookingNumber(admin, user.businessId);
  const completedAt =
    parsed.status === "completed" ? new Date().toISOString() : null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_bookings")
    .insert({
      business_id: user.businessId,
      number,
      resource_id: parsed.resource_id ?? null,
      customer_name: parsed.customer_name,
      customer_phone: parsed.customer_phone ?? null,
      service_title: parsed.service_title,
      starts_at: parsed.starts_at,
      ends_at: parsed.ends_at,
      status: parsed.status ?? "held",
      amount_myr: parsed.amount_myr ?? null,
      notes: parsed.notes ?? null,
      completed_at: completedAt,
      created_by: user.id,
    })
    .select(BOOKING_SELECT)
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
