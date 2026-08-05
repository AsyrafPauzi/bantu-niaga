import {
  describeProfileGaps,
  getProfileCompletionGaps,
  isEmployeeProfileIncomplete,
} from "@/lib/hr/profile-completion";
import type { HrDocumentRow, HrEmployeeRow, HrLeaveRow } from "@/lib/hr/load";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildLeaveCalendarLines(
  leave: HrLeaveRow[],
  today: string,
  horizonDays = 14,
): string[] {
  const end = addDays(today, horizonDays);
  const inRange = leave.filter(
    (row) =>
      (row.status === "approved" || row.status === "pending") &&
      String(row.end_date) >= today &&
      String(row.start_date) <= end,
  );

  if (inRange.length === 0) {
    return ["No pending or approved leave in the next 14 days."];
  }

  return inRange.slice(0, 8).map((row) => {
    const name =
      row.hr_employees?.full_name ?? "Employee";
    return `${name}: ${row.leave_type} ${row.start_date}–${row.end_date} (${row.status})`;
  });
}

export function buildCoverWarningLines(
  leave: HrLeaveRow[],
  today: string,
  horizonDays = 7,
): string[] {
  const end = addDays(today, horizonDays);
  const approved = leave.filter(
    (row) =>
      row.status === "approved" &&
      String(row.end_date) >= today &&
      String(row.start_date) <= end,
  );

  const countByDate = new Map<string, string[]>();
  for (const row of approved) {
    const start = new Date(`${row.start_date}T12:00:00`);
    const finish = new Date(`${row.end_date}T12:00:00`);
    const cursor = new Date(start);
    while (cursor <= finish) {
      const iso = cursor.toISOString().slice(0, 10);
      if (iso >= today && iso <= end) {
        const name = row.hr_employees?.full_name ?? "Staff";
        const list = countByDate.get(iso) ?? [];
        list.push(name);
        countByDate.set(iso, list);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const lines: string[] = [];
  for (const [date, names] of [...countByDate.entries()].sort()) {
    if (names.length >= 2) {
      lines.push(
        `Cover risk ${date}: ${names.length} away (${[...new Set(names)].join(", ")}).`,
      );
    }
  }
  return lines;
}

export function buildProfileGapLines(
  employees: HrEmployeeRow[],
  documents: HrDocumentRow[],
  limit = 5,
): string[] {
  const incomplete = employees.filter((emp) =>
    isEmployeeProfileIncomplete(emp, documents),
  );
  if (incomplete.length === 0) {
    return [];
  }
  return incomplete.slice(0, limit).map((emp) => {
    const gaps = describeProfileGaps(getProfileCompletionGaps(emp, documents));
    return `${emp.full_name}: ${gaps}`;
  });
}

export function formatLeaveBalanceLine(
  fullName: string,
  available: number,
  entitlement: number,
  taken: number,
): string {
  return `${fullName}: ${available} AL left (${taken}/${entitlement} used)`;
}
