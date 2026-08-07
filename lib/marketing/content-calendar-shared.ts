export type ContentChannel = "tiktok" | "instagram" | "facebook";
export type ContentStatus = "idea" | "drafted" | "scheduled" | "posted";

export interface ContentCalendarRow {
  id: string;
  channel: ContentChannel;
  status: ContentStatus;
  scheduled_at: string | null;
  hook: string | null;
}

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const CHANNEL_META: Record<
  ContentChannel,
  { label: string; chip: string; dot: string; ring: string }
> = {
  tiktok: {
    label: "TikTok",
    chip: "bg-[#FFE5DF] text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]",
    dot: "bg-[#8B2418] dark:bg-[#F0B0A6]",
    ring: "ring-[#8B2418]/30 dark:ring-[#F0B0A6]/40",
  },
  instagram: {
    label: "Instagram",
    chip: "bg-[#FCE4D7] text-[#B35628] dark:bg-[#3A1F12] dark:text-[#F2B591]",
    dot: "bg-[#B35628] dark:bg-[#F2B591]",
    ring: "ring-[#B35628]/30 dark:ring-[#F2B591]/40",
  },
  facebook: {
    label: "Facebook",
    chip: "bg-[#FFE3B8] text-[#8C5C0A] dark:bg-[#3A2C12] dark:text-[#F5C97A]",
    dot: "bg-[#8C5C0A] dark:bg-[#F5C97A]",
    ring: "ring-[#8C5C0A]/30 dark:ring-[#F5C97A]/40",
  },
};

export const STATUS_META: Record<
  ContentStatus,
  { label: string; pill: string }
> = {
  idea: {
    label: "Idea",
    pill: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  },
  drafted: {
    label: "Draft",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  },
  scheduled: {
    label: "Scheduled",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  posted: {
    label: "Posted",
    pill: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  },
};

export function isoDayMyt(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isScheduledInMonth(
  scheduledAt: string | null,
  year: number,
  month: number,
): boolean {
  if (!scheduledAt) return false;
  return isoDayMyt(new Date(scheduledAt)).startsWith(monthKey(year, month));
}

export function formatPostTime(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

export function formatDayHeading(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+08:00`).toLocaleDateString("en-MY", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

export interface CalendarCell {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  const todayKey = isoDayMyt(new Date());
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const dayOffset = i - firstWeekday;
    const date = new Date(year, month - 1, 1 + dayOffset);
    const inMonth = date.getMonth() === month - 1;
    const dateKey = isoDayMyt(date);
    const weekday = date.getDay();
    cells.push({
      dateKey,
      day: date.getDate(),
      inMonth,
      isToday: dateKey === todayKey,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }

  return cells;
}

export function groupByDate(
  rows: ContentCalendarRow[],
): Map<string, ContentCalendarRow[]> {
  const map = new Map<string, ContentCalendarRow[]>();
  for (const row of rows) {
    if (!row.scheduled_at) continue;
    const key = isoDayMyt(new Date(row.scheduled_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return ta - tb;
    });
  }
  return map;
}

export interface MonthStats {
  scheduled: number;
  drafted: number;
  idea: number;
  posted: number;
  total: number;
}

export function computeMonthStats(
  rows: ContentCalendarRow[],
  year: number,
  month: number,
): MonthStats {
  const inMonth = rows.filter((r) =>
    isScheduledInMonth(r.scheduled_at, year, month),
  );
  return {
    scheduled: inMonth.filter((r) => r.status === "scheduled").length,
    drafted: inMonth.filter((r) => r.status === "drafted").length,
    idea: inMonth.filter((r) => r.status === "idea").length,
    posted: inMonth.filter((r) => r.status === "posted").length,
    total: inMonth.length,
  };
}
