import { ShieldAlert } from "lucide-react";

import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  StatusPill,
} from "@/components/super-admin/primitives";
import { loadAllDsrsPage, loadDsrSummary } from "@/lib/privacy/load";
import type { DsrStatus } from "@/lib/privacy/types";
import { ListPagination } from "@/components/ui/list-pagination";
import { parsePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy queue · Super admin" };

const STATUS_TONE: Record<DsrStatus, Parameters<typeof StatusPill>[0]["tone"]> = {
  pending: "muted",
  in_progress: "info",
  awaiting_grace: "warning",
  completed: "success",
  cancelled: "muted",
  failed: "danger",
};

const KIND_LABEL: Record<string, string> = {
  export: "Data export",
  delete_user: "Account deletion",
  delete_business: "Business closure",
  rectify: "Rectification",
  consent_change: "Consent change",
  object: "Objection",
};

export default async function SuperAdminPrivacy({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 25 });
  const [{ rows, total }, summary] = await Promise.all([
    loadAllDsrsPage({}, { from: pagination.from, to: pagination.to }),
    loadDsrSummary(),
  ]);

  return (
    <>
      <PageTopbar
        title="Privacy & DSR queue"
        subtitle="Cross-tenant view of every Data-Subject Request"
      />
      <PageBody>
        <div className="flex gap-3">
          <KpiCard label="Pending" value={summary.pending} subtle="need action" />
          <KpiCard
            label="Awaiting grace"
            value={summary.awaitingGrace}
            subtle="scheduled deletions"
          />
          <KpiCard label="Completed" value={summary.completed} subtle="closed DSRs" />
          <KpiCard
            label="Failed"
            value={summary.failed}
            subtle="manual follow-up"
            trend={summary.failed > 0 ? "down" : "flat"}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card">
          <div className="grid grid-cols-[140px_140px_140px_220px_160px_1fr] gap-3 border-b border-cream-300 bg-cream-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            <span>When</span>
            <span>Kind</span>
            <span>Status</span>
            <span>Tenant / User</span>
            <span>Scheduled / Done</span>
            <span>Reason</span>
          </div>
          {rows.length === 0 ? (
            <div className="grid place-items-center px-5 py-12 text-center text-sm text-ink-muted">
              <ShieldAlert className="mb-3 h-7 w-7 text-ink-subtle" />
              No data-subject requests yet. Every export / deletion / consent
              change recorded here.
            </div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[140px_140px_140px_220px_160px_1fr] items-start gap-3 border-b border-cream-300 px-5 py-3 last:border-b-0"
                >
                  <span className="text-[11px] text-ink-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-ink">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  <StatusPill
                    tone={STATUS_TONE[r.status]}
                    label={r.status.replace(/_/g, " ")}
                  />
                  <span className="truncate text-[11px] text-ink-muted">
                    biz {r.businessId.slice(0, 8)} ·{" "}
                    user {r.userId.slice(0, 8)}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {r.completedAt
                      ? `Done ${new Date(r.completedAt).toLocaleDateString()}`
                      : r.scheduledFor
                        ? `On ${new Date(r.scheduledFor).toLocaleDateString()}`
                        : "—"}
                  </span>
                  <span className="truncate text-[11px] text-ink-muted">
                    {r.reason ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ListPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            basePath="/super-admin/privacy"
          />
        </div>
      </PageBody>
    </>
  );
}
