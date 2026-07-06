import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { financeCustomerUpdateSchema } from "@/lib/finance/schemas";
import { normalizeMyPhone } from "@/lib/marketing/phone";

export const dynamic = "force-dynamic";

async function requireFinanceUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!can(user.role, "finance")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "forbidden", message: "Finance access denied." },
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

const CUSTOMER_SELECT =
  "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at";

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
    parsed = financeCustomerUpdateSchema.parse(body);
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
  if (parsed.email === "") patch.email = null;

  if (parsed.phone !== undefined) {
    if (parsed.phone?.trim()) {
      const normalized = normalizeMyPhone(parsed.phone.trim());
      if (!normalized) {
        return NextResponse.json(
          {
            ok: false,
            error: { code: "invalid_phone", message: "Invalid phone number." },
          },
          { status: 400 },
        );
      }
      patch.phone_e164 = normalized;
    } else {
      patch.phone_e164 = null;
    }
    delete patch.phone;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .select(CUSTOMER_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "update_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 200 });
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
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "delete_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
