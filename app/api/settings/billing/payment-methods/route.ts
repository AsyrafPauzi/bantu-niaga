import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paymentMethodCreateSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

const PM_SELECT =
  "id, kind, label, masked, owner_name, exp_month, exp_year, " +
  "is_default, provider, created_at";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select(PM_SELECT)
    .eq("business_id", user.businessId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "list_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden", reason: "Only the owner can add payment methods." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = paymentMethodCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();

  // If make_default, first clear existing default in this business
  // (the partial unique index would otherwise reject the insert).
  if (parsed.make_default) {
    await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("business_id", user.businessId)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      business_id: user.businessId,
      kind: parsed.kind,
      label: parsed.label,
      masked: parsed.masked,
      owner_name: parsed.owner_name ?? null,
      exp_month: parsed.exp_month ?? null,
      exp_year: parsed.exp_year ?? null,
      provider: parsed.provider,
      is_default: parsed.make_default,
    })
    .select(PM_SELECT)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "insert_failed", message: error?.message ?? "no row" },
      { status: 500 },
    );
  }

  const row = data as unknown as { id: string; kind: string; label: string };

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "billing.payment_method.create",
    entity_type: "payment_method",
    entity_id: row.id,
    diff: { kind: row.kind, label: row.label },
  });

  return NextResponse.json({ payment_method: data }, { status: 201 });
}
