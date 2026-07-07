import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { webhookUpdateSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

const SELECT =
  "id, url, events, active, delivered_count, failed_count, last_delivered_at, last_error, created_at";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") return { denied: true as const, user };
  return { denied: false as const, user };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let user;
  try {
    const auth = await requireOwner();
    if (auth.denied) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    user = auth.user;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    parsed = webhookUpdateSchema.parse(body);
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
  const { data, error } = await supabase
    .from("business_webhooks")
    .update(parsed)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ webhook: data }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  let user;
  try {
    const auth = await requireOwner();
    if (auth.denied) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    user = auth.user;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("business_webhooks")
    .delete()
    .eq("id", id)
    .eq("business_id", user.businessId);

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "integrations.webhook.delete",
    entity_type: "business_webhook",
    entity_id: id,
    diff: null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
