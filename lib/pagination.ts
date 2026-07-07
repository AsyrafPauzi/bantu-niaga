export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
  from: number;
  to: number;
}

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function readParam(
  raw: SearchParamsInput,
  key: string,
): string | undefined {
  const value = raw?.[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parsePagination(
  raw?: SearchParamsInput,
  options?: {
    pageKey?: string;
    pageSizeKey?: string;
    defaultPageSize?: number;
    maxPageSize?: number;
  },
): PaginationParams {
  const pageKey = options?.pageKey ?? "page";
  const pageSizeKey = options?.pageSizeKey ?? "pageSize";
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options?.maxPageSize ?? MAX_PAGE_SIZE;

  const page = Math.max(1, Number(readParam(raw, pageKey)) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(
      1,
      Number(readParam(raw, pageSizeKey)) || defaultPageSize,
    ),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function paginateArray<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number } {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
  };
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
