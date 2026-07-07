import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/integrations/business-api-keys";
import { apiKeyCreateSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

const SELECT =
  "id, label, key_prefix, scope, last_used_at, revoked_at, created_at";

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") {
    return { denied: true as const, user };
  }
  return { denied: false as const, user };
}

export async function GET() {
  try {
    await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("business_api_keys")
    .select(SELECT)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}

export async function POST(request: Request) {
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
    parsed = apiKeyCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("business_api_keys")
    .insert({
      business_id: user.businessId,
      label: parsed.label,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scope: parsed.scope,
      created_by: user.id,
    })
    .select(SELECT)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "create_failed", message: error?.message },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "integrations.api_key.create",
    entity_type: "business_api_key",
    entity_id: data.id,
    diff: { label: parsed.label, scope: parsed.scope },
  });

  return NextResponse.json(
    { api_key: data, secret: rawKey },
    { status: 201 },
  );
}
