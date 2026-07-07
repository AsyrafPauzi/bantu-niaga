import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentSessionId,
  listActiveSessions,
} from "@/lib/auth/sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const currentSessionId = await getCurrentSessionId();

  try {
    const sessions = await listActiveSessions(supabase, user.id);
    return NextResponse.json(
      {
        data: sessions.map((s) => ({
          ...s,
          is_current: s.id === currentSessionId,
        })),
        current_session_id: currentSessionId,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "list_failed",
        message: e instanceof Error ? e.message : "Could not list sessions",
      },
      { status: 500 },
    );
  }
}
