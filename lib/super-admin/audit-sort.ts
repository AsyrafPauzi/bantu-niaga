import type { AuditAdminRow } from "./audit-format";
import { formatAuditAction, formatAuditDetails } from "./audit-format";
import type { SortOrder } from "@/lib/super-admin/table-sort";
import { sortInMemory } from "@/lib/super-admin/table-sort";

export type AuditSortField = "when" | "admin" | "action" | "tenant" | "details";

const AUDIT_SORT_FIELDS: readonly AuditSortField[] = [
  "when",
  "admin",
  "action",
  "tenant",
  "details",
];

function readParam(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = raw[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseAuditSort(
  raw: Record<string, string | string[] | undefined>,
): { field: AuditSortField; order: SortOrder } {
  const field = readParam(raw, "sort") as AuditSortField;
  const order = readParam(raw, "order") === "asc" ? "asc" : "desc";
  return {
    field: AUDIT_SORT_FIELDS.includes(field) ? field : "when",
    order: AUDIT_SORT_FIELDS.includes(field) ? order : "desc",
  };
}

export function sortAuditRows(
  rows: AuditAdminRow[],
  sort: { field: AuditSortField; order: SortOrder },
): AuditAdminRow[] {
  switch (sort.field) {
    case "admin":
      return sortInMemory(rows, (row) => row.adminEmail ?? "", sort.order);
    case "action":
      return sortInMemory(
        rows,
        (row) => formatAuditAction(row.action),
        sort.order,
      );
    case "tenant":
      return sortInMemory(rows, (row) => row.businessName ?? "", sort.order);
    case "details":
      return sortInMemory(
        rows,
        (row) => formatAuditDetails(row.action, row.diff),
        sort.order,
      );
    case "when":
    default:
      return sortInMemory(rows, (row) => row.createdAt, sort.order);
  }
}
