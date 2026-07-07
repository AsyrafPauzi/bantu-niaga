import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret, type SealedSecret } from "@/lib/integrations/crypto";

export type ApiKeyScope = "read" | "read+write" | "admin";

const KEY_PREFIX = "bn_live_";

function pepper(): string {
  const fromEnv =
    process.env.API_KEY_PEPPER?.trim() ||
    process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "API_KEY_PEPPER or INTEGRATION_ENCRYPTION_KEY must be set in production.",
    );
  }
  return "bn-dev-api-key-pepper";
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256")
    .update(`${pepper()}:${rawKey}`)
    .digest("hex");
}

export function generateApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const body = randomBytes(24).toString("base64url");
  const rawKey = `${KEY_PREFIX}${body}`;
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, 16),
    keyHash: hashApiKey(rawKey),
  };
}

export function parseBearerApiKey(
  authorization: string | null,
): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  if (!token || !token.startsWith(KEY_PREFIX)) return null;
  return token;
}

export interface ResolvedApiKey {
  id: string;
  businessId: string;
  scope: ApiKeyScope;
  label: string;
}

export async function resolveApiKey(
  supabase: SupabaseClient,
  rawKey: string,
): Promise<ResolvedApiKey | null> {
  const keyHash = hashApiKey(rawKey);
  const { data, error } = await supabase
    .from("business_api_keys")
    .select("id, business_id, scope, label")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;

  await supabase
    .from("business_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id,
    businessId: data.business_id,
    scope: data.scope as ApiKeyScope,
    label: data.label,
  };
}

export function scopeAllows(
  scope: ApiKeyScope,
  required: ApiKeyScope,
): boolean {
  const rank: Record<ApiKeyScope, number> = {
    read: 1,
    "read+write": 2,
    admin: 3,
  };
  return rank[scope] >= rank[required];
}

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("base64url");
}

export function sealWebhookSecret(secret: string) {
  return encryptSecret(secret);
}

export function openWebhookSecret(sealed: SealedSecret): string {
  return decryptSecret(sealed);
}

export function signWebhookBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export interface WebhookDeliveryPayload {
  id: string;
  event: string;
  business_id: string;
  emitted_at: string;
  data: Record<string, unknown>;
}

export async function deliverWebhook(
  url: string,
  secret: string,
  payload: WebhookDeliveryPayload,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const body = JSON.stringify(payload);
  const signature = signWebhookBody(secret, body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BantuNiaga-Webhooks/1.0",
        "X-BantuNiaga-Event": payload.event,
        "X-BantuNiaga-Signature": `sha256=${signature}`,
        "X-BantuNiaga-Delivery-Id": payload.id,
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "Delivery failed",
    };
  }
}
