import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  formatInt,
} from "@/components/super-admin/primitives";
import { PrivacyFilterBar } from "@/components/super-admin/PrivacyFilterBar";
import { SortableTh } from "@/components/super-admin/SortableTh";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_PAGE_SIZE_OPTIONS,
  parsePagination,
  withPageSizeSearchParam,
} from "@/lib/pagination";
import { loadAllDsrsPage, loadDsrSummary } from "@/lib/privacy/load";
import { parseDsrSort } from "@/lib/privacy/dsr-sort";
import type { DsrKind, DsrStatus } from "@/lib/privacy/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy queue · Super admin" };

const KIND_LABEL: Record<DsrKind, string> = {
  export: "Data export",
  delete_user: "Account deletion",
  delete_business: "Business closure",
  rectify: "Rectification",
  consent_change: "Consent change",
  object: "Objection",
};

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} · ${time}`;
}

function formatTimelineDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dsrStatus(status: DsrStatus): React.ReactNode {
  const map: Record<DsrStatus, { dot: string; label: string }> = {
    pending: { dot: "bg-ink-muted", label: "Pending" },
    in_progress: { dot: "bg-status-info", label: "In progress" },
    awaiting_grace: { dot: "bg-status-warning", label: "Awaiting grace" },
    completed: { dot: "bg-status-success", label: "Completed" },
    cancelled: { dot: "bg-ink-muted", label: "Cancelled" },
    failed: { dot: "bg-status-danger", label: "Failed" },
  };
  const item = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
      {item.label}
    </span>
  );
}

function timelineCell(row: {
  status: DsrStatus;
  scheduledFor: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}): React.ReactNode {
  if (row.completedAt) {
    return (
      <span className="text-[11px] text-ink-muted">
        Completed · {formatTimelineDate(row.completedAt)}
      </span>
    );
  }
  if (row.cancelledAt) {
    return (
      <span className="text-[11px] text-ink-muted">
        Cancelled · {formatTimelineDate(row.cancelledAt)}
      </span>
    );
  }
  if (row.scheduledFor) {
    return (
      <span className="text-[11px] text-ink-muted">
        Due · {formatTimelineDate(row.scheduledFor)}
      </span>
    );
  }
  if (row.status === "in_progress") {
    return <span className="text-[11px] text-ink-muted">Processing</span>;
  }
  return <span className="text-[11px] text-ink-muted">—</span>;
}

export default async function SuperAdminPrivacy({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
    allowedPageSizes: ADMIN_PAGE_SIZE_OPTIONS,
  });
  const sortState = parseDsrSort(params);
  const q = paramString(params.q);
  const kind = paramString(params.kind) || "all";
  const status = paramString(params.status) || "all";

  const [{ rows, total }, summary] = await Promise.all([
    loadAllDsrsPage({
      from: pagination.from,
      to: pagination.to,
      filters: {
        q: q || undefined,
        kind,
        status,
      },
      sort: sortState,
    }),
    loadDsrSummary(),
  ]);

  const filterActive = Boolean(q || kind !== "all" || status !== "all");
  const listSearchParams = withPageSizeSearchParam(
    {
      q: q || undefined,
      kind: kind !== "all" ? kind : undefined,
      status: status !== "all" ? status : undefined,
      sort: sortState.field !== "submitted" ? sortState.field : undefined,
      order:
        sortState.field !== "submitted" || sortState.order !== "desc"
          ? sortState.order
          : undefined,
    },
    pagination.pageSize,
  );
  const hasListState =
    filterActive ||
    sortState.field !== "submitted" ||
    sortState.order !== "desc" ||
    pagination.pageSize !== ADMIN_DEFAULT_PAGE_SIZE;

  return (
    <>
      <PageTopbar
        title="Privacy queue"
        subtitle="Cross-tenant data-subject requests from data_subject_requests"
        right={
          <Link
            href="/super-admin/businesses"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            <Building2 className="h-3.5 w-3.5" />
            Tenants
          </Link>
        }
      />

      <PageBody>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <KpiCard
            label="Total"
            value={formatInt(summary.total)}
            subtle="all requests"
            trend="flat"
          />
          <KpiCard
            label="Open"
            value={formatInt(summary.open)}
            subtle="pending + in progress"
            trend={summary.open > 0 ? "down" : "flat"}
          />
          <KpiCard
            label="Awaiting grace"
            value={formatInt(summary.awaitingGrace)}
            subtle="scheduled deletions"
            trend={summary.awaitingGrace > 0 ? "down" : "flat"}
          />
          <KpiCard
            label="Completed"
            value={formatInt(summary.completed)}
            subtle="closed successfully"
            trend="up"
          />
        </div>

        <Suspense
          fallback={
            <div className="h-[88px] animate-pulse rounded-xl border border-cream-300 bg-white" />
          }
        >
          <PrivacyFilterBar
            initialQ={q}
            initialKind={kind}
            initialStatus={status}
          />
        </Suspense>

        <Section
          className="!p-4 !pb-0"
          title="Request queue"
          description={
            filterActive
              ? `${formatInt(total)} matching`
              : `${formatInt(total)} requests`
          }
        >
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              {filterActive
                ? "No requests match your filters."
                : "No data-subject requests yet. Exports, deletions, and consent changes will appear here."}
            </p>
          ) : (
            <div className="-mx-4 mt-3 overflow-x-auto border-t border-cream-200">
              <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <SortableTh
                      label="Submitted"
                      field="submitted"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/privacy"
                      searchParams={listSearchParams}
                      className="px-4 py-2"
                    />
                    <SortableTh
                      label="Type"
                      field="type"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/privacy"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Status"
                      field="status"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/privacy"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Tenant"
                      field="tenant"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/privacy"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="User"
                      field="user"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/privacy"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Timeline"
                      field="timeline"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/privacy"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="align-middle hover:bg-cream-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-2 text-[11px] text-ink-muted">
                        {formatSubmitted(row.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink">
                          {KIND_LABEL[row.kind]}
                        </p>
                        {row.reason ? (
                          <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-ink-muted">
                            {row.reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{dsrStatus(row.status)}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/super-admin/businesses/${row.businessId}`}
                          className="block max-w-[180px] truncate font-medium text-brand-700 hover:underline"
                        >
                          {row.businessName ?? "Unknown tenant"}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <p className="truncate font-medium text-ink">
                          {row.userDisplayName?.trim() || "Unnamed user"}
                        </p>
                        <p className="truncate text-[11px] text-ink-muted">
                          {row.userEmail ?? "No email"}
                        </p>
                      </td>
                      <td className="px-3 py-2">{timelineCell(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ListPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            basePath="/super-admin/privacy"
            searchParams={hasListState ? listSearchParams : undefined}
            pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
            defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
          />
        </Section>
      </PageBody>
    </>
  );
}
