import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import {
  operationsBookingResourceCreateSchema,
  type OperationsBookingResourceRow,
} from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

const RESOURCE_SELECT =
  "id, business_id, name, description, buffer_minutes, is_active, " +
  "created_by, created_at, updated_at";

export async function GET() {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_booking_resources")
    .select(RESOURCE_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

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
    {
      ok: true,
      data: (data ?? []) as unknown as OperationsBookingResourceRow[],
    },
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
    parsed = operationsBookingResourceCreateSchema.parse(body);
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
    .from("operations_booking_resources")
    .insert({
      business_id: user.businessId,
      name: parsed.name,
      description: parsed.description ?? null,
      buffer_minutes: parsed.buffer_minutes ?? 0,
      is_active: parsed.is_active ?? true,
      created_by: user.id,
    })
    .select(RESOURCE_SELECT)
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
