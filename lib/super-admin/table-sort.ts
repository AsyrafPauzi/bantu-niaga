import type { BusinessRowAdmin, UserRowAdmin } from "./types";

export type SortOrder = "asc" | "desc";

export type UsersSortField =
  | "name"
  | "tenant"
  | "role"
  | "plan"
  | "status"
  | "joined";

export type BusinessesSortField =
  | "tenant"
  | "plan"
  | "subscription"
  | "health"
  | "users"
  | "credits"
  | "joined";

const USERS_SORT_FIELDS: readonly UsersSortField[] = [
  "name",
  "tenant",
  "role",
  "plan",
  "status",
  "joined",
];

const BUSINESSES_SORT_FIELDS: readonly BusinessesSortField[] = [
  "tenant",
  "plan",
  "subscription",
  "health",
  "users",
  "credits",
  "joined",
];

function readParam(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = raw[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseUsersSort(
  raw: Record<string, string | string[] | undefined>,
): { field: UsersSortField; order: SortOrder } {
  const field = readParam(raw, "sort") as UsersSortField;
  const order = readParam(raw, "order") === "asc" ? "asc" : "desc";
  return {
    field: USERS_SORT_FIELDS.includes(field) ? field : "joined",
    order: USERS_SORT_FIELDS.includes(field) ? order : "desc",
  };
}

export function parseBusinessesSort(
  raw: Record<string, string | string[] | undefined>,
): { field: BusinessesSortField; order: SortOrder } {
  const field = readParam(raw, "sort") as BusinessesSortField;
  const order = readParam(raw, "order") === "asc" ? "asc" : "desc";
  return {
    field: BUSINESSES_SORT_FIELDS.includes(field) ? field : "joined",
    order: BUSINESSES_SORT_FIELDS.includes(field) ? order : "desc",
  };
}

export function compareForSort(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
  order: SortOrder,
): number {
  const aMissing = a == null || a === "";
  const bMissing = b == null || b === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  let result = 0;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else if (typeof a === "boolean" && typeof b === "boolean") {
    result = Number(a) - Number(b);
  } else {
    result = String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
  }
  return order === "asc" ? result : -result;
}

export function sortInMemory<T>(
  rows: T[],
  getter: (row: T) => string | number | boolean | null | undefined,
  order: SortOrder,
): T[] {
  return [...rows].sort((left, right) =>
    compareForSort(getter(left), getter(right), order),
  );
}

export function sortUserRows(
  rows: UserRowAdmin[],
  sort: { field: UsersSortField; order: SortOrder },
): UserRowAdmin[] {
  switch (sort.field) {
    case "name":
      return sortInMemory(
        rows,
        (row) => row.display_name?.trim() || row.email || "",
        sort.order,
      );
    case "tenant":
      return sortInMemory(rows, (row) => row.business_name ?? "", sort.order);
    case "role":
      return sortInMemory(rows, (row) => row.role, sort.order);
    case "plan":
      return sortInMemory(rows, (row) => row.business_tier ?? "", sort.order);
    case "status":
      return sortInMemory(rows, (row) => row.is_suspended ?? false, sort.order);
    case "joined":
    default:
      return sortInMemory(rows, (row) => row.created_at ?? "", sort.order);
  }
}

export function sortBusinessRows(
  rows: BusinessRowAdmin[],
  sort: { field: BusinessesSortField; order: SortOrder },
): BusinessRowAdmin[] {
  switch (sort.field) {
    case "tenant":
      return sortInMemory(rows, (row) => row.name, sort.order);
    case "plan":
      return sortInMemory(rows, (row) => row.tier, sort.order);
    case "subscription":
      return sortInMemory(
        rows,
        (row) => row.subscription_status,
        sort.order,
      );
    case "health":
      return sortInMemory(
        rows,
        (row) => row.health_score ?? -1,
        sort.order,
      );
    case "users":
      return sortInMemory(rows, (row) => row.user_count ?? 0, sort.order);
    case "credits":
      return sortInMemory(rows, (row) => row.credit_balance, sort.order);
    case "joined":
    default:
      return sortInMemory(rows, (row) => row.created_at, sort.order);
  }
}
