import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  boardroomAgentLabel,
  canManageBoardroom,
} from "@/lib/ai/boardroom-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Helvetica (WinAnsi) cannot encode emoji / many Unicode glyphs.
 * Map common symbols, then drop anything still outside Latin-1 printable.
 */
function toWinAnsiSafe(text: string): string {
  return text
    .replace(/\u26a0\ufe0f?/g, "[!]")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u00b7\u25cf\u25e6]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?")
    .replace(/\*\*/g, "");
}

/** GET /api/boardroom/meetings/[id]/pdf */
export async function GET(_request: Request, context: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  if (!canManageBoardroom(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  const [meetingRes, messagesRes, businessRes] = await Promise.all([
    supabase
      .from("boardroom_meetings")
      .select("id, title, status, invited_agent_ids, created_at, ended_at")
      .eq("id", id)
      .eq("business_id", user.businessId)
      .maybeSingle(),
    supabase
      .from("boardroom_messages")
      .select("role, agent_id, content, created_at")
      .eq("meeting_id", id)
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: true }),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", user.businessId)
      .maybeSingle(),
  ]);

  if (!meetingRes.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meeting = meetingRes.data;
  const messages = messagesRes.data ?? [];
  const businessName = businessRes.data?.name ?? "Business";

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  const margin = 48;
  let y = 842 - margin;

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = pdf.addPage([595, 842]);
      y = 842 - margin;
    }
  }

  function drawText(
    text: string,
    size: number,
    bold = false,
    color = rgb(0.1, 0.1, 0.1),
  ) {
    const f = bold ? fontBold : font;
    const maxWidth = 595 - margin * 2;
    const safe = toWinAnsiSafe(text);
    const words = safe.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      let width: number;
      try {
        width = f.widthOfTextAtSize(test, size);
      } catch {
        // Last-resort: skip glyphs WinAnsi still rejects
        continue;
      }
      if (width > maxWidth) {
        if (line) {
          ensureSpace(size + 4);
          page.drawText(line, { x: margin, y, size, font: f, color });
          y -= size + 4;
        }
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ensureSpace(size + 4);
      try {
        page.drawText(line, { x: margin, y, size, font: f, color });
        y -= size + 6;
      } catch {
        // Skip unencodable leftover line rather than 500 the export
        y -= size + 6;
      }
    }
  }

  drawText("Bantu Niaga - AI Boardroom", 16, true);
  drawText(businessName, 11);
  drawText(
    meeting.title ||
      `Meeting ${new Date(meeting.created_at).toLocaleString("en-MY")}`,
    12,
    true,
  );
  drawText(
    `Attendees: ${(meeting.invited_agent_ids ?? []).map(boardroomAgentLabel).join(", ")}`,
    10,
  );
  drawText(`Status: ${meeting.status}`, 10);
  y -= 8;

  for (const m of messages) {
    let label = "System";
    if (m.role === "user") label = "Owner";
    else if (m.role === "agent")
      label = boardroomAgentLabel(m.agent_id ?? "agent");
    else if (m.role === "room_clarifier") label = "Room questions";
    else if (m.role === "synth") label = "Recommendation";

    ensureSpace(28);
    drawText(label, 10, true, rgb(0.2, 0.35, 0.25));
    drawText(m.content, 9);
    y -= 6;
  }

  const bytes = await pdf.save();
  const filename = `boardroom-${id.slice(0, 8)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
