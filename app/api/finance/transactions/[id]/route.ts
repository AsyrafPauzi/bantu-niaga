import { NextResponse } from "next/server";
import { dbErrorResponse } from "@/lib/api/db-error";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  financeTransactionUpdateSchema,
  type FinanceTransactionRow,
} from "@/lib/finance/schemas";
import { resolveAdminFileIdPatch, loadAdminFileNames } from "@/lib/admin/validate-admin-file";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = financeTransactionUpdateSchema.parse(body);
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

  const { data: existing, error: loadError } = await supabase
    .from("finance_transactions")
    .select("id, finance_invoice_id, description")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "Transaction not found." },
      },
      { status: 404 },
    );
  }

  if (
    existing.finance_invoice_id ||
    String(existing.description ?? "").startsWith("POS ")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "locked_entry",
          message: "System-linked entries cannot be edited here.",
        },
      },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { ...parsed };
  if (parsed.admin_file_id !== undefined) {
    const fileCheck = await resolveAdminFileIdPatch(
      supabase,
      user.businessId,
      parsed.admin_file_id,
    );
    if (!fileCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "invalid_file", message: fileCheck.message },
        },
        { status: 400 },
      );
    }
    patch.admin_file_id = fileCheck.value;
  }

  const { data, error } = await supabase
    .from("finance_transactions")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(
      "id, business_id, kind, amount_myr, category, description, counterparty, " +
        "payment_method, txn_date, finance_invoice_id, admin_file_id, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    return dbErrorResponse("update_failed", error, "finance.api.update_failed", { route: "update_failed" });
  }

  let admin_file_name: string | null = null;
  const row = data as unknown as FinanceTransactionRow | null;
  if (row?.admin_file_id) {
    const names = await loadAdminFileNames(supabase, user.businessId, [
      row.admin_file_id,
    ]);
    admin_file_name = names.get(row.admin_file_id) ?? null;
  }

  return NextResponse.json(
    { ok: true, data: row ? { ...row, admin_file_name } : row },
    { status: 200 },
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("finance_transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return dbErrorResponse("delete_failed", error, "finance.api.delete_failed", { route: "delete_failed" });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
