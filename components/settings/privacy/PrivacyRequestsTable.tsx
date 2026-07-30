"use client";

import { useState } from "react";
import { Download, History, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DataSubjectRequest, DsrStatus } from "@/lib/privacy/types";

interface Props {
  initialRequests: DataSubjectRequest[];
  totalCount: number;
  listLimit?: number;
}

const STATUS_TONE: Record<
  DsrStatus,
  "neutral" | "brand" | "warning" | "success" | "danger"
> = {
  pending: "neutral",
  in_progress: "brand",
  awaiting_grace: "warning",
  completed: "success",
  cancelled: "neutral",
  failed: "danger",
};

const KIND_LABEL: Record<DataSubjectRequest["kind"], string> = {
  export: "Data export",
  delete_user: "Account deletion",
  delete_business: "Business closure",
  rectify: "Data correction",
  consent_change: "Consent update",
  object: "Processing objection",
};

function statusLabel(status: DsrStatus): string {
  return status.replace(/_/g, " ");
}

export function PrivacyRequestsTable({
  initialRequests,
  totalCount,
  listLimit = 10,
}: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allRequests = initialRequests.filter(
    (r) => r.kind !== "rectify" && r.kind !== "object",
  );
  const requests = allRequests.slice(0, listLimit);
  const filteredTotal = totalCount;

  async function downloadExport(exportId: string) {
    setError(null);
    setDownloadingId(exportId);
    try {
      const res = await fetch(`/api/privacy/export/${exportId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError("Export expired or not found.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bantuniaga-data-export-${exportId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download export.");
    } finally {
      setDownloadingId(null);
    }
  }

  function exportIdFromRequest(r: DataSubjectRequest): string | null {
    const id = r.payload?.export_id;
    return typeof id === "string" ? id : null;
  }

  return (
    <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <History className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            Request history
          </h2>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {filteredTotal === 0
              ? "No requests yet"
              : filteredTotal > requests.length
                ? `Showing ${requests.length} of ${filteredTotal}`
                : `${filteredTotal} request${filteredTotal === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {error ? (
        <p className="border-b border-cream-200 px-4 py-3 text-sm text-status-danger dark:border-hairline-dark">
          {error}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted dark:text-cream-400">
          Exports, deletions, and consent changes appear here.
        </p>
      ) : (
        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {requests.map((r) => {
            const exportId = exportIdFromRequest(r);
            const canDownload =
              r.kind === "export" &&
              r.status === "completed" &&
              exportId != null;

            return (
              <li
                key={r.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink dark:text-cream-100">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </p>
                    <Badge tone={STATUS_TONE[r.status]}>
                      {statusLabel(r.status)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
                    {new Date(r.createdAt).toLocaleDateString("en-MY", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {r.scheduledFor && r.status === "awaiting_grace"
                      ? ` · scheduled ${new Date(r.scheduledFor).toLocaleDateString("en-MY")}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0">
                  {canDownload ? (
                    <button
                      type="button"
                      onClick={() => downloadExport(exportId)}
                      disabled={downloadingId === exportId}
                      className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-100"
                    >
                      {downloadingId === exportId ? (
                        <Loader2
                          className="h-3 w-3 animate-spin"
                          strokeWidth={2}
                        />
                      ) : (
                        <Download className="h-3 w-3" strokeWidth={2} />
                      )}
                      Download
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
