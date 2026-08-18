import { NextResponse } from "next/server";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { logger } from "@/lib/logger";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "billing.start-basic-trial",
    5,
    60 * 60 * 1000,
  );
  if (!rl.ok) return rl.response;

  if (isStandaloneDeployment()) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (user.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("settings_start_basic_trial", {
    p_business_id: user.businessId,
    p_user_id: user.id,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("trial_already_used")) {
      return NextResponse.json({ error: "trial_already_used" }, { status: 409 });
    }
    if (message.includes("invalid_status")) {
      return NextResponse.json({ error: "invalid_status" }, { status: 409 });
    }
    logger.error("start_basic_trial_failed", { message });
    return NextResponse.json({ error: "start_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
