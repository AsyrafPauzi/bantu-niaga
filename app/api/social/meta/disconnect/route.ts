import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/social/meta/disconnect
 *
 * Marks a social_accounts row as `disconnected` and zeros the access
 * token so it cannot be used to call Graph any more. The row itself is
 * kept around so historical publishes still resolve to a meaningful
 * account name in the Insights tab.
 *
 * Body: { accountId: string }   (uuid of the social_accounts row)
 *
 * Optional `cascadeProvider` flag: if the caller passes `"both"` and the
 * account is a Facebook Page that has a linked Instagram row, we
 * disconnect both in one shot.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  accountId: z.string().uuid(),
  cascadeProvider: z.enum(["self", "both"]).optional().default("self"),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return NextResponse.json(
        { error: "forbidden", reason: "marketing.content access required" },
        { status: 403 },
      );
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
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

  const { data: account, error: loadErr } = await supabase
    .from("social_accounts")
    .select("id, provider, external_id, linked_fb_page_id")
    .eq("business_id", user.businessId)
    .eq("id", parsed.accountId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json(
      { error: "load_failed", message: loadErr.message },
      { status: 500 },
    );
  }
  if (!account) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const idsToDisconnect = [account.id];
  if (parsed.cascadeProvider === "both" && account.linked_fb_page_id) {
    // Find any siblings (FB Page + IG row that share the same Page id).
    const { data: siblings } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("business_id", user.businessId)
      .eq("linked_fb_page_id", account.linked_fb_page_id);
    if (siblings) {
      for (const s of siblings) {
        if (!idsToDisconnect.includes(s.id)) idsToDisconnect.push(s.id);
      }
    }
  }

  const { error: updErr } = await supabase
    .from("social_accounts")
    .update({
      status: "disconnected",
      access_token: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("business_id", user.businessId)
    .in("id", idsToDisconnect);

  if (updErr) {
    return NextResponse.json(
      { error: "update_failed", message: updErr.message },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "social.meta.disconnected",
    entity_type: "social_account",
    entity_id: account.id,
    diff: {
      provider: account.provider,
      cascade: parsed.cascadeProvider,
      disconnected_ids: idsToDisconnect,
    },
  });

  return NextResponse.json(
    { action: "disconnected", disconnected_ids: idsToDisconnect },
    { status: 200 },
  );
}
