import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { dispatchOrderCompleted } from "@/lib/events/dispatch-cross-pillar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { operationsOrderUpdateSchema, type OperationsOrderRow } from "@/lib/operations/schemas";
import { resolveAdminFileIdPatch, loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import {
  notifyOperationsOrderDeleted,
  notifyOperationsOrderStatusChanged,
} from "@/lib/operations/notify";

export const dynamic = "force-dynamic";

async function requireOperationsUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!can(user.role, "operations")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to access Operations.",
            },
          },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "unauthorized", message: "Authentication required." },
          },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

const ORDER_SELECT =
  "id, business_id, number, customer_name, customer_phone, title, description, " +
  "status, fulfillment_type, fulfillment_status, due_date, amount_myr, supplier_id, notes, admin_file_id, completed_at, " +
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
    parsed = operationsOrderUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  const patch: Record<string, unknown> = { ...parsed };
  if (parsed.status === "done") {
    patch.completed_at = new Date().toISOString();
  } else if (parsed.status === "todo" || parsed.status === "in_progress") {
    patch.completed_at = null;
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("operations_orders")
    .select("number, title, status")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "Order not found." },
      },
      { status: 404 },
    );
  }

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
    .from("operations_orders")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(ORDER_SELECT)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: status === 404 ? "not_found" : "update_failed",
          message: status === 404 ? "Order not found." : error.message,
        },
      },
      { status },
    );
  }

  let admin_file_name: string | null = null;
  const row = data as unknown as OperationsOrderRow | null;
  if (row?.admin_file_id) {
    const names = await loadAdminFileNames(supabase, user.businessId, [
      row.admin_file_id,
    ]);
    admin_file_name = names.get(row.admin_file_id) ?? null;
  }

  if (
    row &&
    parsed.status &&
    parsed.status !== existing.status
  ) {
    notifyOperationsOrderStatusChanged({
      businessId: user.businessId,
      orderId: id,
      number: row.number,
      title: row.title,
      status: row.status,
    });

    if (
      parsed.status === "done" &&
      existing.status !== "done" &&
      can(user.role, "finance")
    ) {
      void dispatchOrderCompleted({
        supabase,
        payload: {
          business_id: user.businessId,
          order_id: id,
          user_id: user.id,
          can_finance: true,
        },
      });
    }
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
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("operations_orders")
    .select("number")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  const { error } = await supabase
    .from("operations_orders")
    .update({ deleted_at: new Date().toISOString() })
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

  if (existing?.number) {
    notifyOperationsOrderDeleted({
      businessId: user.businessId,
      orderId: id,
      number: existing.number as string,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
