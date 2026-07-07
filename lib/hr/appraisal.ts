export type AppraisalDisplayStatus = "pending" | "overdue" | "completed";

export interface AppraisalRowLike {
  status: string;
  due_date: string;
}

export function appraisalDisplayStatus(
  row: AppraisalRowLike,
  todayIso: string,
): AppraisalDisplayStatus {
  if (row.status === "completed") return "completed";
  if (row.due_date < todayIso) return "overdue";
  return "pending";
}

export function appraisalStatusLabel(status: AppraisalDisplayStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    default:
      return "Due";
  }
}
