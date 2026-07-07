import { NextResponse } from "next/server";
import { authenticateApiKeyRequest } from "@/lib/auth/api-key-request";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * GET /api/external/v1/ping — verify a tenant API key works.
 *
 * curl -H "Authorization: Bearer bn_live_…" https://app…/api/external/v1/ping
 */
export async function GET(request: Request) {
  const auth = await authenticateApiKeyRequest(request, "read");
  if (!auth.ok) return auth.response;

  const rl = consume({
    bucket: "external.api",
    identifier: `key:${auth.key.id}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: rl.retryAfterSeconds },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const svc = createServiceRoleClient();
  const { data: business } = await svc
    .from("businesses")
    .select("id, name, idcompany, tier")
    .eq("id", auth.key.businessId)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "business_not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      business: {
        id: business.id,
        name: business.name,
        idcompany: business.idcompany,
        tier: business.tier,
      },
      api_key: {
        id: auth.key.id,
        label: auth.key.label,
        scope: auth.key.scope,
      },
    },
    { status: 200 },
  );
}
