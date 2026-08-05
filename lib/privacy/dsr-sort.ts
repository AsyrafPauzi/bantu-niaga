import type { DsrAdminRow } from "./types";
import type { SortOrder } from "@/lib/super-admin/table-sort";
import { sortInMemory } from "@/lib/super-admin/table-sort";

export type DsrSortField =
  | "submitted"
  | "type"
  | "status"
  | "tenant"
  | "user"
  | "timeline";

const DSR_SORT_FIELDS: readonly DsrSortField[] = [
  "submitted",
  "type",
  "status",
  "tenant",
  "user",
  "timeline",
];

function readParam(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = raw[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseDsrSort(
  raw: Record<string, string | string[] | undefined>,
): { field: DsrSortField; order: SortOrder } {
  const field = readParam(raw, "sort") as DsrSortField;
  const order = readParam(raw, "order") === "asc" ? "asc" : "desc";
  return {
    field: DSR_SORT_FIELDS.includes(field) ? field : "submitted",
    order: DSR_SORT_FIELDS.includes(field) ? order : "desc",
  };
}

function timelineValue(row: DsrAdminRow): string {
  return row.completedAt ?? row.scheduledFor ?? row.createdAt;
}

export function sortDsrRows(
  rows: DsrAdminRow[],
  sort: { field: DsrSortField; order: SortOrder },
): DsrAdminRow[] {
  switch (sort.field) {
    case "type":
      return sortInMemory(rows, (row) => row.kind, sort.order);
    case "status":
      return sortInMemory(rows, (row) => row.status, sort.order);
    case "tenant":
      return sortInMemory(rows, (row) => row.businessName ?? "", sort.order);
    case "user":
      return sortInMemory(
        rows,
        (row) => row.userDisplayName?.trim() || row.userEmail || "",
        sort.order,
      );
    case "timeline":
      return sortInMemory(rows, (row) => timelineValue(row), sort.order);
    case "submitted":
    default:
      return sortInMemory(rows, (row) => row.createdAt, sort.order);
  }
}
