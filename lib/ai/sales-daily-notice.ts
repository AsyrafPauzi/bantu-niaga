import type { PillarSnapshot } from "@/lib/ai/context/types";
import { malaysiaTodayIso } from "@/lib/ai/sales-assistant-tools";

export interface SalesDailyNotice {
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

/** Template-only daily Sales notice (0 LLM credits). */
export function buildSalesDailyNotice(
  snapshot: PillarSnapshot,
  displayName: string,
): SalesDailyNotice {
  const noticeDate = malaysiaTodayIso();
  const lines: string[] = [];

  if (!snapshot.available) {
    lines.push(
      "No leads or POS sales yet — add a lead or open POS to start the day.",
    );
  } else {
    for (const item of snapshot.attention.slice(0, 4)) {
      lines.push(`• ${item.label}`);
    }
    if (lines.length === 0) {
      lines.push("• Pipeline looks calm — keep ringing sales at the counter.");
    }
    const salesKpi = snapshot.kpis.find((k) => k.key === "sales_today");
    if (salesKpi) {
      lines.push(`• Sales today: RM ${salesKpi.value}`);
    }
  }

  return {
    noticeDate,
    title: `${displayName} — Sales notice · ${formatNoticeDate(noticeDate)}`,
    body: lines.join("\n"),
  };
}
