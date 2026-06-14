"use client";

import { Inbox } from "lucide-react";

import type { DataSubjectRequest, DsrStatus } from "@/lib/privacy/types";

interface Props {
  initialRequests: DataSubjectRequest[];
}

const STATUS_TONE: Record<DsrStatus, string> = {
  pending: "bg-cream-200 text-ink-subtle dark:bg-hairline-dark dark:text-cream-400",
  in_progress:
    "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  awaiting_grace:
    "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]",
  completed:
    "bg-status-success/15 text-status-success",
  cancelled:
    "bg-cream-200 text-ink-subtle dark:bg-hairline-dark dark:text-cream-400",
  failed:
    "bg-status-danger/15 text-status-danger",
};

const KIND_LABEL: Record<DataSubjectRequest["kind"], string> = {
  export: "Data export",
  delete_user: "Account deletion",
  delete_business: "Business closure",
  rectify: "Rectification",
  consent_change: "Consent change",
  object: "Objection",
};

export function PrivacyRequestsTable({ initialRequests }: Props) {
  if (initialRequests.length === 0) {
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
          Anything you do above (exports, deletions, consent toggles) will
          show up here for your records.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-cream-200 bg-white p-6 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <h2 className="text-base font-semibold text-ink dark:text-cream-100">
        Recent privacy requests
      </h2>
      <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
        Chronological log of every right you&apos;ve exercised. Retained for 7
        years per PDPA s.7.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-cream-200 dark:border-hairline-dark">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-50 text-[10px] font-bold uppercase tracking-wider text-ink-subtle dark:bg-panel-dark/40">
            <tr>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Scheduled / Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {initialRequests.map((r) => (
              <tr key={r.id} className="bg-white dark:bg-panel-dark">
                <td className="px-4 py-3 align-top text-ink dark:text-cream-100">
                  {KIND_LABEL[r.kind] ?? r.kind}
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
                <td className="px-4 py-3 align-top text-ink-muted dark:text-cream-400">
                  {r.completedAt
                    ? `Done ${new Date(r.completedAt).toLocaleDateString("en-MY")}`
                    : r.scheduledFor
                      ? `On ${new Date(r.scheduledFor).toLocaleDateString("en-MY")}`
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
