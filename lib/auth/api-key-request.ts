import "server-only";

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  parseBearerApiKey,
  resolveApiKey,
  scopeAllows,
  type ApiKeyScope,
  type ResolvedApiKey,
} from "@/lib/integrations/business-api-keys";

export async function authenticateApiKeyRequest(
  request: Request,
  requiredScope: ApiKeyScope = "read",
): Promise<
  | { ok: true; key: ResolvedApiKey }
  | { ok: false; response: NextResponse }
> {
  const raw = parseBearerApiKey(request.headers.get("authorization"));
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "unauthorized",
          message:
            "Missing API key. Pass Authorization: Bearer bn_live_…",
        },
        { status: 401 },
      ),
    };
  }

  const supabase = createServiceRoleClient();
  const key = await resolveApiKey(supabase, raw);
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", message: "Invalid or revoked API key." },
        { status: 401 },
      ),
    };
  }

  if (!scopeAllows(key.scope, requiredScope)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "forbidden",
          message: `This key has scope "${key.scope}" but "${requiredScope}" is required.`,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, key };
}
