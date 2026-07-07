import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deliverWebhook,
  openWebhookSecret,
} from "@/lib/integrations/business-api-keys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireOwner() {
  const user = await getCurrentUser();
  if (user.role !== "owner") return { denied: true as const, user };
  return { denied: false as const, user };
}

/**
 * POST — send a test ping (or retry last delivery) to the webhook URL.
 */
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

  const supabase = await createSupabaseServerClient();
  const { data: hook, error } = await supabase
    .from("business_webhooks")
    .select(
      "id, url, secret_sealed, events, active, delivered_count, failed_count",
    )
    .eq("id", id)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!hook) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!hook.active) {
    return NextResponse.json(
      { error: "webhook_disabled", message: "Enable the webhook first." },
      { status: 400 },
    );
  }

  let secret: string;
  try {
    secret = openWebhookSecret(hook.secret_sealed);
  } catch (e) {
    return NextResponse.json(
      {
        error: "secret_unavailable",
        message: e instanceof Error ? e.message : "Could not decrypt secret",
      },
      { status: 500 },
    );
  }

  const event =
    Array.isArray(hook.events) && hook.events.length > 0
      ? String(hook.events[0])
      : "webhook.test";

  const payload = {
    id: randomUUID(),
    event,
    business_id: user.businessId,
    emitted_at: new Date().toISOString(),
    data: {
      test: true,
      message: "Bantu Niaga webhook test delivery",
    },
  };

  const result = await deliverWebhook(hook.url, secret, payload);
  const now = new Date().toISOString();

  await supabase
    .from("business_webhooks")
    .update({
      delivered_count: result.ok
        ? Number(hook.delivered_count ?? 0) + 1
        : Number(hook.delivered_count ?? 0),
      failed_count: result.ok
        ? Number(hook.failed_count ?? 0)
        : Number(hook.failed_count ?? 0) + 1,
      ...(result.ok
        ? { last_delivered_at: now, last_error: null }
        : { last_error: result.error ?? `HTTP ${result.status}` }),
    })
    .eq("id", id);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "delivery_failed",
        message: result.error ?? `HTTP ${result.status}`,
        status: result.status,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true, delivery_id: payload.id, status: result.status },
    { status: 200 },
  );
}
