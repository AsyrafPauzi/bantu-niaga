/** Pure helpers for the HR owner “today” desk. */

export function dateInRange(ymd: string, start: string, end: string): boolean {
  return ymd >= start && ymd <= end;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function partitionLeaveForDesk<
  T extends { start_date: string; end_date: string; status: string },
>(leaves: readonly T[], todayYmd: string, weekEndYmd: string) {
  const approved = leaves.filter((l) => l.status === "approved");
  const today = approved.filter((l) =>
    dateInRange(todayYmd, l.start_date, l.end_date),
  );
  const thisWeek = approved.filter((l) =>
    rangesOverlap(l.start_date, l.end_date, todayYmd, weekEndYmd),
  );
  return { today, thisWeek };
}

export function selectExpiringContracts<
  T extends { contract_end_date: string | null },
>(
  employees: readonly T[],
  todayYmd: string,
  withinDays: number,
): T[] {
  const end = addDaysYmd(todayYmd, withinDays);
  return employees
    .filter(
      (e) =>
        e.contract_end_date &&
        e.contract_end_date >= todayYmd &&
        e.contract_end_date <= end,
    )
    .sort((a, b) =>
      (a.contract_end_date ?? "") < (b.contract_end_date ?? "") ? -1 : 1,
    );
}
