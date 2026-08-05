import type { SupabaseClient } from "@supabase/supabase-js";
import {
  boardroomAgentLabel,
  isBoardroomInvitable,
} from "@/lib/ai/boardroom-access";
import { loadBoardroomStatus } from "@/lib/ai/boardroom";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_MAX_INVITEES } from "@/lib/ai/boardroom-shared";

export type ApplyBoardroomInvitesResult =
  | { ok: true; invited: BoardroomAgentId[]; added: BoardroomAgentId[] }
  | { ok: false; message: string };

/** Add live agents to an active meeting (e.g. depth checkpoint call-in). */
export async function applyBoardroomMeetingInvites(opts: {
  supabase: SupabaseClient;
  businessId: string;
  meetingId: string;
  currentInvited: BoardroomAgentId[];
  inviteAgentIds: string[];
}): Promise<ApplyBoardroomInvitesResult> {
  const status = await loadBoardroomStatus(opts.businessId);
  const liveIds = new Set(
    status.agents.filter((a) => a.live).map((a) => a.id),
  );

  const toAdd = [...new Set(opts.inviteAgentIds)]
    .filter(isBoardroomInvitable)
    .filter((id) => !opts.currentInvited.includes(id)) as BoardroomAgentId[];

  if (toAdd.length === 0) {
    return { ok: true, invited: opts.currentInvited, added: [] };
  }

  const notLive = toAdd.filter((id) => !liveIds.has(id));
  if (notLive.length > 0) {
    const names = notLive.map((id) => boardroomAgentLabel(id)).join(", ");
    return {
      ok: false,
      message: `Switch on these team members in Settings first: ${names}`,
    };
  }

  const merged = [...opts.currentInvited, ...toAdd];
  if (merged.length > BOARDROOM_MAX_INVITEES) {
    return {
      ok: false,
      message: `You can invite up to ${BOARDROOM_MAX_INVITEES} team members.`,
    };
  }

  const { error } = await opts.supabase
    .from("boardroom_meetings")
    .update({ invited_agent_ids: merged })
    .eq("id", opts.meetingId)
    .eq("business_id", opts.businessId);

  if (error) {
    return { ok: false, message: "Could not update meeting attendees." };
  }

  const labels = toAdd.map((id) => boardroomAgentLabel(id)).join(", ");
  await opts.supabase.from("boardroom_messages").insert({
    business_id: opts.businessId,
    meeting_id: opts.meetingId,
    role: "system",
    content: `${labels} joined the meeting.`,
  });

  return { ok: true, invited: merged, added: toAdd };
}
