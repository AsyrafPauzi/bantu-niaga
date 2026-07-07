import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST /api/onboarding/complete — mark recommendation page done (skip or finish). */
export async function POST() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden", message: "Only the owner can complete onboarding." },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("businesses")
    .update({ onboarding_completed_at: now })
    .eq("id", user.businessId);

  if (error) {
    return NextResponse.json(
      { error: "complete_failed", message: error.message },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "onboarding.completed",
    entity_type: "business",
    entity_id: user.businessId,
    diff: { completed_at: now },
  });

  return NextResponse.json({ ok: true, completed_at: now });
}
