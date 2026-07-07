import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/integrations/business-api-keys";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") return { denied: true as const, user };
  return { denied: false as const, user };
}

export async function POST(_request: Request, context: RouteContext) {
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

  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("business_api_keys")
    .update({
      key_prefix: keyPrefix,
      key_hash: keyHash,
      last_used_at: null,
    })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("revoked_at", null)
    .select("id, label, key_prefix, scope, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "rotate_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "integrations.api_key.rotate",
    entity_type: "business_api_key",
    entity_id: id,
    diff: { label: data.label },
  });

  return NextResponse.json({ api_key: data, secret: rawKey }, { status: 200 });
}
