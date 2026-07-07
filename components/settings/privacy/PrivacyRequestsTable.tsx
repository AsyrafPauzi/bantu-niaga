"use client";

import { useState } from "react";
import { Download, Inbox, Loader2 } from "lucide-react";

import type { DataSubjectRequest, DsrStatus } from "@/lib/privacy/types";

interface Props {
  initialRequests: DataSubjectRequest[];
}

const STATUS_TONE: Record<DsrStatus, string> = {
  pending:
    "bg-cream-200 text-ink-subtle dark:bg-hairline-dark dark:text-cream-400",
  in_progress:
    "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  awaiting_grace:
    "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]",
  completed: "bg-status-success/15 text-status-success",
  cancelled:
    "bg-cream-200 text-ink-subtle dark:bg-hairline-dark dark:text-cream-400",
  failed: "bg-status-danger/15 text-status-danger",
};

const KIND_LABEL: Record<DataSubjectRequest["kind"], string> = {
  export: "Data export",
  delete_user: "Account deletion",
  delete_business: "Business closure",
  rectify: "Data correction",
  consent_change: "Consent update",
  object: "Processing objection",
};

export function PrivacyRequestsTable({ initialRequests }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requests = initialRequests.filter(
    (r) => r.kind !== "rectify" && r.kind !== "object",
  );

  async function downloadExport(exportId: string) {
    setError(null);
    setDownloadingId(exportId);
    try {
      const res = await fetch(`/api/privacy/export/${exportId}`);
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

  if (requests.length === 0) {
    return (
      <section className="rounded-xl border border-cream-200 bg-white p-6 text-center shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <span
          aria-hidden
          className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-cream-100 text-ink-subtle dark:bg-hairline-dark dark:text-cream-400"
        >
          <Inbox className="h-5 w-5" strokeWidth={2} />
        </span>
        <p className="mt-2 text-sm font-semibold text-ink dark:text-cream-100">
          No privacy requests yet
        </p>
        <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
          Exports, deletions, and consent changes you make above appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-cream-200 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <h2 className="text-base font-semibold text-ink dark:text-cream-100">
        Your privacy requests
      </h2>
      <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
        Log of data exports, deletions, and consent updates for this account.
      </p>

      {error ? (
        <p className="mt-3 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-cream-200 dark:border-hairline-dark">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-50 text-[10px] font-bold uppercase tracking-wider text-ink-subtle dark:bg-panel-dark/40">
            <tr>
              <th className="px-4 py-2">Request</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {requests.map((r) => {
              const exportId = exportIdFromRequest(r);
              const canDownload =
                r.kind === "export" &&
                r.status === "completed" &&
                exportId != null;

              return (
                <tr key={r.id} className="bg-white dark:bg-panel-dark">
                  <td className="px-4 py-3 align-top text-ink dark:text-cream-100">
                    {KIND_LABEL[r.kind] ?? r.kind}
                    {r.scheduledFor && r.status === "awaiting_grace" ? (
                      <p className="mt-0.5 text-[11px] text-ink-muted dark:text-cream-400">
                        Scheduled{" "}
                        {new Date(r.scheduledFor).toLocaleDateString("en-MY")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[r.status]}`}
                    >
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted dark:text-cream-400">
                    {new Date(r.createdAt).toLocaleDateString("en-MY")}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    {canDownload ? (
                      <button
                        type="button"
                        onClick={() => downloadExport(exportId)}
                        disabled={downloadingId === exportId}
                        className="inline-flex items-center gap-1 rounded-md border border-cream-300 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-100"
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
                    ) : (
                      <span className="text-[11px] text-ink-subtle">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
