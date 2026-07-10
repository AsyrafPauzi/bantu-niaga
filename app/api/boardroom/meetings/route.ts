import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  BOARDROOM_INVITABLE_V1,
  canManageBoardroom,
  isInvitableV1,
} from "@/lib/ai/boardroom-access";
import { loadBoardroomStatus } from "@/lib/ai/boardroom";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireBoardroomUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageBoardroom(user.role)) {
      return {
        user: null,
        response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: e.code },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

const startSchema = z.object({
  invited_agent_ids: z
    .array(z.string())
    .min(2)
    .max(5),
  title: z.string().trim().max(200).optional(),
  replace_paused: z.boolean().optional(),
});

/** GET /api/boardroom/meetings — active/paused + recent ended. */
export async function GET() {
  const { user, response } = await requireBoardroomUser();
  if (response) return response;

  const supabase = await createSupabaseServerClient();
  const status = await loadBoardroomStatus(user.businessId);

  const [openRes, historyRes] = await Promise.all([
    supabase
      .from("boardroom_meetings")
      .select(
        "id, status, invited_agent_ids, title, awaiting_clarifiers, credits_spent, created_at, updated_at, paused_at, ended_at",
      )
      .eq("business_id", user.businessId)
      .in("status", ["active", "paused"])
      .order("updated_at", { ascending: false })
      .limit(2),
    supabase
      .from("boardroom_meetings")
      .select(
        "id, status, invited_agent_ids, title, credits_spent, created_at, ended_at",
      )
      .eq("business_id", user.businessId)
      .eq("status", "ended")
      .order("ended_at", { ascending: false })
      .limit(20),
  ]);

  const invitable = BOARDROOM_INVITABLE_V1.map((id) => {
    const agent = status.agents.find((a) => a.id === id);
    return {
      id,
      label: agent?.label ?? id,
      role: agent?.role ?? "",
      live: agent?.live ?? false,
    };
  });

  return NextResponse.json({
    unlocked: status.unlocked,
    agents: status.agents,
    invitable,
    open: openRes.data ?? [],
    history: historyRes.data ?? [],
  });
}

/** POST /api/boardroom/meetings — start a new meeting. */
export async function POST(request: Request) {
  const { user, response } = await requireBoardroomUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = startSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const invited = [...new Set(parsed.invited_agent_ids)].filter(isInvitableV1);
  if (invited.length < 2) {
    return NextResponse.json(
      {
        error: "need_two_agents",
        message: "Invite at least 2 live agents (Maya, Hana, or Sufi).",
      },
      { status: 400 },
    );
  }

  const status = await loadBoardroomStatus(user.businessId);
  const liveIds = new Set(
    status.agents.filter((a) => a.live).map((a) => a.id),
  );
  const notLive = invited.filter((id) => !liveIds.has(id));
  if (notLive.length > 0) {
    return NextResponse.json(
      {
        error: "agent_not_live",
        message: `Activate these agents in Marketplace first: ${notLive.join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (!status.unlocked) {
    return NextResponse.json(
      {
        error: "boardroom_locked",
        message: "Activate at least 2 AI agents in Marketplace to unlock Boardroom.",
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: existingOpen } = await supabase
    .from("boardroom_meetings")
    .select("id, status")
    .eq("business_id", user.businessId)
    .in("status", ["active", "paused"]);

  const paused = (existingOpen ?? []).find((m) => m.status === "paused");
  const active = (existingOpen ?? []).find((m) => m.status === "active");

  if (active) {
    return NextResponse.json(
      {
        error: "meeting_active",
        message: "You already have an active meeting. Pause or end it first.",
        meeting_id: active.id,
      },
      { status: 409 },
    );
  }

  if (paused && !parsed.replace_paused) {
    return NextResponse.json(
      {
        error: "paused_exists",
        message:
          "You have a paused meeting. Resume it, or confirm Start new to replace it.",
        meeting_id: paused.id,
        needs_confirm: true,
      },
      { status: 409 },
    );
  }

  if (paused && parsed.replace_paused) {
    await supabase
      .from("boardroom_meetings")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        awaiting_clarifiers: false,
        pending_decisions: null,
        pending_actions: null,
      })
      .eq("id", paused.id)
      .eq("business_id", user.businessId);
  }

  const { data: meeting, error } = await supabase
    .from("boardroom_meetings")
    .insert({
      business_id: user.businessId,
      created_by: user.id,
      status: "active",
      invited_agent_ids: invited,
      title: parsed.title?.trim() || null,
    })
    .select(
      "id, status, invited_agent_ids, title, awaiting_clarifiers, credits_spent, created_at",
    )
    .single();

  if (error || !meeting) {
    return NextResponse.json(
      { error: "create_failed", message: error?.message ?? "Could not start" },
      { status: 500 },
    );
  }

  await supabase.from("boardroom_messages").insert({
    business_id: user.businessId,
    meeting_id: meeting.id,
    role: "system",
    content: `Meeting started with ${invited.join(", ")}. Ask the room anything.`,
  });

  return NextResponse.json({ data: meeting }, { status: 201 });
}
