import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { financeCustomerCreateSchema } from "@/lib/finance/schemas";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import type { FinanceCustomerRow } from "@/lib/finance/schemas";

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

export async function GET(request: Request) {
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(200);

  if (q.length > 0) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone_e164.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "list_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, data: (data ?? []) as unknown as FinanceCustomerRow[] },
    { status: 200 },
  );
}

export async function POST(request: Request) {
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
    parsed = financeCustomerCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  let phoneE164: string | null = null;
  if (parsed.phone?.trim()) {
    phoneE164 = normalizeMyPhone(parsed.phone.trim());
    if (!phoneE164) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "invalid_phone", message: "Invalid phone number." },
        },
        { status: 400 },
      );
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: user.businessId,
      name: parsed.name,
      phone_e164: phoneE164,
      email: parsed.email || null,
      address: parsed.address ?? null,
      notes: parsed.notes ?? null,
      source: "manual",
      created_by_user_id: user.id,
    })
    .select(CUSTOMER_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "create_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
