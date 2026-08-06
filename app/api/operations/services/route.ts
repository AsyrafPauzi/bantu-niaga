import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { ZodError } from "zod";
import { resolveAdminFileIdPatch } from "@/lib/admin/validate-admin-file";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import {
  operationsServiceCreateSchema,
  type OperationsServiceRow,
} from "@/lib/operations/schemas";

export const dynamic = "force-dynamic";

const SERVICE_SELECT =
  "id, business_id, name, description, duration_minutes, price_myr, " +
  "is_active, notes, image_file_id, created_by, created_at, updated_at";

export async function GET() {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_services")
    .select(SERVICE_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    return dbErrorResponse("list_failed", error, "operations.api.list_failed");
  }

  return NextResponse.json(
    { ok: true, data: (data ?? []) as unknown as OperationsServiceRow[] },
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
    parsed = operationsServiceCreateSchema.parse(body);
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

  let imageFileId: string | null = null;
  if (parsed.image_file_id) {
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
    imageFileId = resolved.value;
  }

  const { data, error } = await supabase
    .from("operations_services")
    .insert({
      business_id: user.businessId,
      name: parsed.name,
      description: parsed.description ?? null,
      duration_minutes: parsed.duration_minutes ?? 60,
      price_myr: parsed.price_myr ?? null,
      is_active: parsed.is_active ?? true,
      notes: parsed.notes ?? null,
      image_file_id: imageFileId,
      created_by: user.id,
    })
    .select(SERVICE_SELECT)
    .single();

  if (error) {
    const code =
      error.code === "23505" ? "duplicate_name" : "create_failed";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message:
            code === "duplicate_name"
              ? "A service with that name already exists."
              : "Could not complete request.",
        },
      },
      { status: code === "duplicate_name" ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
