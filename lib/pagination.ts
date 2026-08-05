export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const ADMIN_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const ADMIN_DEFAULT_PAGE_SIZE = 10;
export const DOCUMENTS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DOCUMENTS_DEFAULT_PAGE_SIZE = 25;

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
    allowedPageSizes?: readonly number[];
  },
): PaginationParams {
  const pageKey = options?.pageKey ?? "page";
  const pageSizeKey = options?.pageSizeKey ?? "pageSize";
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options?.maxPageSize ?? MAX_PAGE_SIZE;
  const allowedPageSizes = options?.allowedPageSizes;

  const page = Math.max(1, Number(readParam(raw, pageKey)) || 1);
  const rawPageSize = Number(readParam(raw, pageSizeKey)) || defaultPageSize;
  const normalizedPageSize =
    allowedPageSizes && allowedPageSizes.length > 0
      ? allowedPageSizes.includes(rawPageSize)
        ? rawPageSize
        : defaultPageSize
      : rawPageSize;
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, normalizedPageSize),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function withPageSizeSearchParam(
  params: Record<string, string | undefined>,
  pageSize: number,
  defaultPageSize = ADMIN_DEFAULT_PAGE_SIZE,
): Record<string, string | undefined> {
  return {
    ...params,
    pageSize: pageSize !== defaultPageSize ? String(pageSize) : undefined,
  };
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
