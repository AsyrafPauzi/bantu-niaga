import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateWebhookSecret,
  sealWebhookSecret,
} from "@/lib/integrations/business-api-keys";
import { encryptionConfigured } from "@/lib/integrations/crypto";
import { webhookCreateSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";

const SELECT =
  "id, url, events, active, delivered_count, failed_count, last_delivered_at, last_error, created_at";

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") return { denied: true as const, user };
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
    .from("business_webhooks")
    .select(SELECT)
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

  if (!encryptionConfigured()) {
    return NextResponse.json(
      {
        error: "encryption_not_configured",
        message:
          "INTEGRATION_ENCRYPTION_KEY must be set before creating webhooks.",
      },
      { status: 503 },
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
    parsed = webhookCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const secret = generateWebhookSecret();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("business_webhooks")
    .insert({
      business_id: user.businessId,
      url: parsed.url,
      secret_sealed: sealWebhookSecret(secret),
      events: parsed.events,
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
    action: "integrations.webhook.create",
    entity_type: "business_webhook",
    entity_id: data.id,
    diff: { url: parsed.url, events: parsed.events },
  });

  return NextResponse.json(
    { webhook: data, signing_secret: secret },
    { status: 201 },
  );
}
