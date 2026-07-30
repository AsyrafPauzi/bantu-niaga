import "server-only";

import { categoryLabel, type AdminComplianceRow } from "@/lib/admin/task-compliance-schemas";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildComplianceExportCsv(items: AdminComplianceRow[]): string {
  const header = [
    "Title",
    "Category",
    "Authority",
    "Reference",
    "Expires on",
    "Days until expiry",
    "Status",
    "Last renewed",
    "Notes",
  ].join(",");

  const rows = items.map((item) =>
    [
      csvEscape(item.title),
      csvEscape(categoryLabel(item.category)),
      csvEscape(item.authority ?? ""),
      csvEscape(item.reference_number ?? ""),
      item.expires_on,
      String(item.days_until_expiry ?? ""),
      item.status,
      item.last_renewed_at
        ? item.last_renewed_at.slice(0, 10)
        : "",
      csvEscape(item.notes ?? ""),
    ].join(","),
  );

  return [header, ...rows].join("\n");
}

export function buildComplianceExportHtml(items: AdminComplianceRow[]): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(categoryLabel(item.category))}</td>
        <td>${escapeHtml(item.authority ?? "—")}</td>
        <td>${escapeHtml(item.reference_number ?? "—")}</td>
        <td>${item.expires_on}</td>
        <td>${item.days_until_expiry ?? "—"}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Licence tracker export</title>
<style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f0}</style>
</head><body><h1>Licence &amp; permit tracker</h1><p>Exported ${new Date().toLocaleString("en-MY")}</p>
<table><thead><tr><th>Title</th><th>Category</th><th>Authority</th><th>Reference</th><th>Expires</th><th>Days left</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
