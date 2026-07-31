/**
 * Build CSV export URL preserving list filters (search, tags, source, spend)
 * or explicit customer ids for a selection export.
 */
export function buildCustomersExportUrl(
  params: Record<string, string | undefined>,
): string {
  const u = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) u.set(key, value);
  }
  const qs = u.toString();
  return `/api/marketing/customers/csv-export${qs ? `?${qs}` : ""}`;
}
