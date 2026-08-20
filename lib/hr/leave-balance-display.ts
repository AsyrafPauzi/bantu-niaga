export type BalanceLineKey = "annual" | "mc" | "emergency" | "hospitalisation";

export type BalanceLine = {
  key: BalanceLineKey;
  label: string;
  used: number | null;
  entitlement: number | null;
  remaining: number | null;
};

const LABELS: Record<BalanceLineKey, string> = {
  annual: "Annual leave",
  mc: "Medical leave (MC)",
  emergency: "Emergency leave",
  hospitalisation: "Hospitalisation leave",
};

/** Inclusive calendar days between YYYY-MM-DD dates. */
export function inclusiveCalendarDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function countApprovedLeaveDaysByType(
  leaves: ReadonlyArray<{
    leave_type: string;
    start_date: string;
    end_date: string;
    status: string;
  }>,
  leaveYear: number,
): Partial<Record<"mc" | "emergency" | "hospitalisation", number>> {
  const out: Partial<Record<"mc" | "emergency" | "hospitalisation", number>> = {};
  for (const row of leaves) {
    if (row.status !== "approved") continue;
    if (
      row.leave_type !== "mc" &&
      row.leave_type !== "emergency" &&
      row.leave_type !== "hospitalisation"
    ) {
      continue;
    }
    const year = Number(row.start_date.slice(0, 4));
    if (year !== leaveYear) continue;
    const days = inclusiveCalendarDays(row.start_date, row.end_date);
    out[row.leave_type] = (out[row.leave_type] ?? 0) + days;
  }
  return out;
}

export function buildLeaveBalanceLines(input: {
  annual: { entitlement: number; taken: number };
  caps: { mc?: number; emergency?: number; hospitalisation?: number };
  usedByType: Partial<Record<"mc" | "emergency" | "hospitalisation", number>>;
}): BalanceLine[] {
  const lines: BalanceLine[] = [
    {
      key: "annual",
      label: LABELS.annual,
      used: input.annual.taken,
      entitlement: input.annual.entitlement,
      remaining: Math.max(0, input.annual.entitlement - input.annual.taken),
    },
  ];

  for (const key of ["mc", "emergency", "hospitalisation"] as const) {
    const entitlement =
      typeof input.caps[key] === "number" ? Number(input.caps[key]) : null;
    if (entitlement === null) {
      lines.push({
        key,
        label: LABELS[key],
        used: null,
        entitlement: null,
        remaining: null,
      });
      continue;
    }
    const used = Number(input.usedByType[key] ?? 0);
    lines.push({
      key,
      label: LABELS[key],
      used,
      entitlement,
      remaining: Math.max(0, entitlement - used),
    });
  }

  return lines;
}
