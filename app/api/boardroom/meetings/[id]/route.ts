import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageBoardroom } from "@/lib/ai/boardroom-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

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

const patchSchema = z
  .object({
    action: z.enum(["pause", "resume", "end"]),
  })
  .strict();

export async function GET(_request: Request, context: RouteContext) {
  const { user, response } = await requireBoardroomUser();
  if (response) return response;

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  const [meetingRes, messagesRes] = await Promise.all([
    supabase
      .from("boardroom_meetings")
      .select(
        "id, status, invited_agent_ids, title, awaiting_clarifiers, credits_spent, created_at, updated_at, paused_at, ended_at",
      )
      .eq("id", id)
      .eq("business_id", user.businessId)
      .maybeSingle(),
    supabase
      .from("boardroom_messages")
      .select("id, role, agent_id, content, meta, created_at")
      .eq("meeting_id", id)
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: true }),
  ]);

  if (!meetingRes.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    data: meetingRes.data,
    messages: messagesRes.data ?? [],
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user, response } = await requireBoardroomUser();
  if (response) return response;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = patchSchema.parse(body);
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
  const { data: meeting } = await supabase
    .from("boardroom_meetings")
    .select("id, status")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (!meeting) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (parsed.action === "pause") {
    if (meeting.status !== "active") {
      return NextResponse.json(
        { error: "invalid_state", message: "Only an active meeting can be paused." },
        { status: 400 },
      );
    }
    // End any other paused (should be none due to unique index)
    const { data: updated, error } = await supabase
      .from("boardroom_meetings")
      .update({
        status: "paused",
        paused_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", user.businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "update_failed", message: error.message },
        { status: 500 },
      );
    }

    await supabase.from("boardroom_messages").insert({
      business_id: user.businessId,
      meeting_id: id,
      role: "system",
      content: "Meeting paused. You can resume later from Boardroom.",
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  }

  if (parsed.action === "resume") {
    if (meeting.status !== "paused") {
      return NextResponse.json(
        { error: "invalid_state", message: "Only a paused meeting can be resumed." },
        { status: 400 },
      );
    }
    const { data: active } = await supabase
      .from("boardroom_meetings")
      .select("id")
      .eq("business_id", user.businessId)
      .eq("status", "active")
      .maybeSingle();
    if (active) {
      return NextResponse.json(
        {
          error: "meeting_active",
          message: "End or pause the current active meeting first.",
        },
        { status: 409 },
      );
    }

    const { data: updated, error } = await supabase
      .from("boardroom_meetings")
      .update({
        status: "active",
        paused_at: null,
      })
      .eq("id", id)
      .eq("business_id", user.businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "update_failed", message: error.message },
        { status: 500 },
      );
    }

    await supabase.from("boardroom_messages").insert({
      business_id: user.businessId,
      meeting_id: id,
      role: "system",
      content: "Meeting resumed.",
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  }

  // end
  if (meeting.status === "ended") {
    return NextResponse.json({ error: "already_ended" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("boardroom_meetings")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      awaiting_clarifiers: false,
      pending_decisions: null,
      pending_actions: null,
    })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 500 },
    );
  }

  await supabase.from("boardroom_messages").insert({
    business_id: user.businessId,
    meeting_id: id,
    role: "system",
    content: "Meeting ended. You can export a PDF from history.",
  });

  return NextResponse.json({ data: updated }, { status: 200 });
}
