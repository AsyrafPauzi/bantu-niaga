import type { PillarSnapshot } from "@/lib/ai/context/types";
import { malaysiaTodayIso } from "@/lib/ai/hr-assistant-tools";

export interface HrDailyNotice {
  title: string;
  body: string;
  noticeDate: string;
}

function formatNoticeDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(`${iso}T00:00:00`));
}

/**
 * Template-only daily HR notice (0 LLM credits).
 */
export function buildHrDailyNotice(
  snapshot: PillarSnapshot,
  displayName: string,
): HrDailyNotice {
  const noticeDate = malaysiaTodayIso();
  const lines: string[] = [];

  if (!snapshot.available) {
    lines.push("No HR records yet — add your first employee to get started.");
  } else {
    for (const item of snapshot.attention.slice(0, 4)) {
      lines.push(`• ${item.label}`);
    }
    if (lines.length === 0) {
      lines.push("• No urgent HR items today — your team records look up to date.");
    }
    if (snapshot.notes) {
      lines.push(`• ${snapshot.notes}`);
    }
  }

  return {
    noticeDate,
    title: `${displayName} — HR notice · ${formatNoticeDate(noticeDate)}`,
    body: lines.join("\n"),
  };
}
