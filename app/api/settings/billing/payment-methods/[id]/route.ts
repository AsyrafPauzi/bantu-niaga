import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paymentMethodUpdateSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

const PM_SELECT =
  "id, kind, label, masked, owner_name, exp_month, exp_year, " +
  "is_default, provider, created_at";

async function authOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") {
    return { user, denied: true } as const;
  }
  return { user, denied: false } as const;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let user;
  try {
    const auth = await authOwner();
    if (auth.denied) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    user = auth.user;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = paymentMethodUpdateSchema.parse(body);
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

  // Clear other defaults when promoting one.
  if (parsed.is_default === true) {
    await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("business_id", user.businessId)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("payment_methods")
    .update(parsed)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .select(PM_SELECT)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "update_failed", message: error?.message ?? "no row" },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "billing.payment_method.update",
    entity_type: "payment_method",
    entity_id: id,
    diff: parsed,
  });

  return NextResponse.json({ payment_method: data }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let user;
  try {
    const auth = await authOwner();
    if (auth.denied) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    user = auth.user;
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

  // Don't allow deleting the last default if it's the only method.
  const { data: existing } = await supabase
    .from("payment_methods")
    .select("id, is_default")
    .eq("business_id", user.businessId);

  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const target = existing.find((p) => p.id === id);
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (target.is_default && existing.length === 1) {
    return NextResponse.json(
      {
        error: "last_method",
        message: "Add a backup method before removing the last one.",
      },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id)
    .eq("business_id", user.businessId);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 },
    );
  }

  // If we removed the default, promote the most recently created method.
  if (target.is_default) {
    const next = existing
      .filter((p) => p.id !== id)
      .sort()[0];
    if (next) {
      await supabase
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", next.id);
    }
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "billing.payment_method.delete",
    entity_type: "payment_method",
    entity_id: id,
    diff: null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
