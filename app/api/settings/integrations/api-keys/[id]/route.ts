import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") return { denied: true as const, user };
  return { denied: false as const, user };
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
  const { data, error } = await supabase
    .from("business_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("revoked_at", null)
    .select("id, label")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "integrations.api_key.revoke",
    entity_type: "business_api_key",
    entity_id: id,
    diff: { label: data.label },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
