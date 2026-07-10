import type { PillarSnapshot } from "@/lib/ai/context/types";
import { malaysiaTodayIso } from "@/lib/ai/marketing-assistant-tools";

export interface MarketingDailyNotice {
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

/** Template-only daily Marketing notice (0 LLM credits). */
export function buildMarketingDailyNotice(
  snapshot: PillarSnapshot,
  displayName: string,
): MarketingDailyNotice {
  const noticeDate = malaysiaTodayIso();
  const lines: string[] = [];

  if (!snapshot.available) {
    lines.push(
      "No Marketing records yet — add customers to start winning them back.",
    );
  } else {
    for (const item of snapshot.attention.slice(0, 4)) {
      lines.push(`• ${item.label}`);
    }
    if (lines.length === 0) {
      lines.push(
        "• No urgent Marketing items today — your CRM looks up to date.",
      );
    }
    if (snapshot.notes) {
      lines.push(`• ${snapshot.notes}`);
    }
  }

  return {
    noticeDate,
    title: `${displayName} — Marketing notice · ${formatNoticeDate(noticeDate)}`,
    body: lines.join("\n"),
  };
}
