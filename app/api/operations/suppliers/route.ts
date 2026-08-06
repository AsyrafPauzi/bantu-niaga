import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { withApiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOperationsUser } from "@/lib/operations/require-user";
import {
  operationsSupplierCreateSchema,
  type OperationsSupplierRow,
} from "@/lib/operations/schemas";
import { notifyOperationsSupplierCreated } from "@/lib/operations/notify";

export const dynamic = "force-dynamic";

const SUPPLIER_SELECT =
  "id, business_id, name, contact_name, phone, email, address, " +
  "payment_terms, notes, created_by, created_at, updated_at";

export const GET = withApiHandler(
  { module: "operations.suppliers.list", auth: "none" },
  async ({ requestId }) => {
    const auth = await requireOperationsUser();
    if (auth.response) return auth.response;
    const { user } = auth;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("operations_suppliers")
      .select(SUPPLIER_SELECT)
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      return dbErrorResponse(
        "list_failed",
        error,
        "operations.suppliers.list_failed",
        { requestId },
      );
    }

    return ok((data ?? []) as unknown as OperationsSupplierRow[], { requestId });
  },
);

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
    parsed = operationsSupplierCreateSchema.parse(body);
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
    .from("operations_suppliers")
    .insert({
      business_id: user.businessId,
      name: parsed.name,
      contact_name: parsed.contact_name ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email || null,
      address: parsed.address ?? null,
      payment_terms: parsed.payment_terms ?? null,
      notes: parsed.notes ?? null,
      created_by: user.id,
    })
    .select(SUPPLIER_SELECT)
    .single();

  if (error) {
    return dbErrorResponse("create_failed", error, "operations.api.create_failed");
  }

  const row = data as unknown as { id: string; name: string };
  notifyOperationsSupplierCreated({
    businessId: user.businessId,
    supplierId: row.id,
    name: row.name,
  });

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
