import type { PillarSnapshot } from "@/lib/ai/context/types";
import { malaysiaTodayIso } from "@/lib/ai/hr-assistant-tools";

export interface PillarDailyNotice {
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

/** Template-only daily notice from a pillar snapshot (0 LLM credits). */
export function buildPillarDailyNotice(
  snapshot: PillarSnapshot,
  displayName: string,
  pillarLabel: string,
  emptyMessage: string,
  calmMessage: string,
): PillarDailyNotice {
  const noticeDate = malaysiaTodayIso();
  const lines: string[] = [];

  if (!snapshot.available) {
    lines.push(emptyMessage);
  } else {
    for (const item of snapshot.attention.slice(0, 4)) {
      lines.push(`• ${item.label}`);
    }
    if (lines.length === 0) {
      lines.push(calmMessage);
    }
    if (snapshot.notes) {
      lines.push(`• ${snapshot.notes}`);
    }
  }

  return {
    noticeDate,
    title: `${displayName} — ${pillarLabel} notice · ${formatNoticeDate(noticeDate)}`,
    body: lines.join("\n"),
  };
}
