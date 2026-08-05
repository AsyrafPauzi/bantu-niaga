import Link from "next/link";
import { Suspense } from "react";
import { UsersRound } from "lucide-react";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  formatInt,
} from "@/components/super-admin/primitives";
import { AuditFilterBar } from "@/components/super-admin/AuditFilterBar";
import { SortableTh } from "@/components/super-admin/SortableTh";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_PAGE_SIZE_OPTIONS,
  parsePagination,
  withPageSizeSearchParam,
} from "@/lib/pagination";
import { loadAuditPage, loadAuditSummary } from "@/lib/super-admin/audit-load";
import {
  formatAuditAction,
  formatAuditDetails,
  type AuditCategory,
} from "@/lib/super-admin/audit-format";
import { parseAuditSort } from "@/lib/super-admin/audit-sort";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log · Super admin" };

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatWhen(iso: string): string {
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

export default async function SuperAdminAudit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
    allowedPageSizes: ADMIN_PAGE_SIZE_OPTIONS,
  });
  const sortState = parseAuditSort(params);
  const q = paramString(params.q);
  const category = (paramString(params.category) || "all") as AuditCategory;

  const [summary, { rows, total }] = await Promise.all([
    loadAuditSummary(),
    loadAuditPage({
      from: pagination.from,
      to: pagination.to,
      filters: {
        q: q || undefined,
        category,
      },
      sort: sortState,
    }),
  ]);

  const filterActive = Boolean(q || category !== "all");
  const listSearchParams = withPageSizeSearchParam(
    {
      q: q || undefined,
      category: category !== "all" ? category : undefined,
      sort: sortState.field !== "when" ? sortState.field : undefined,
      order:
        sortState.field !== "when" || sortState.order !== "desc"
          ? sortState.order
          : undefined,
    },
    pagination.pageSize,
  );
  const hasListState =
    filterActive ||
    sortState.field !== "when" ||
    sortState.order !== "desc" ||
    pagination.pageSize !== ADMIN_DEFAULT_PAGE_SIZE;

  return (
    <>
      <PageTopbar
        title="Audit log"
        subtitle="Platform-admin actions recorded in super_admin_audit"
        right={
          <Link
            href="/super-admin/users"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            <UsersRound className="h-3.5 w-3.5" />
            Users
          </Link>
        }
      />

      <PageBody>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <KpiCard
            label="Total"
            value={formatInt(summary.total)}
            subtle="all entries"
            trend="flat"
          />
          <KpiCard
            label="Last 7 days"
            value={formatInt(summary.last7d)}
            subtle="recent activity"
            trend="up"
          />
          <KpiCard
            label="User actions"
            value={formatInt(summary.userActions)}
            subtle="suspend, role, impersonate"
            trend="flat"
          />
          <KpiCard
            label="Integrations"
            value={formatInt(summary.integrationActions)}
            subtle="config and tests"
            trend="flat"
          />
        </div>

        <Suspense
          fallback={
            <div className="h-[88px] animate-pulse rounded-xl border border-cream-300 bg-white" />
          }
        >
          <AuditFilterBar initialQ={q} initialCategory={category} />
        </Suspense>

        <Section
          className="!p-4 !pb-0"
          title="Activity log"
          description={
            filterActive
              ? `${formatInt(total)} matching`
              : `${formatInt(total)} entries`
          }
        >
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              {filterActive
                ? "No audit entries match your filters."
                : "No platform-admin actions yet. Super-admin mutations are recorded here automatically."}
            </p>
          ) : (
            <div className="-mx-4 mt-3 overflow-x-auto border-t border-cream-200">
              <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <SortableTh
                      label="When"
                      field="when"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/audit"
                      searchParams={listSearchParams}
                      className="px-4 py-2"
                    />
                    <SortableTh
                      label="Admin"
                      field="admin"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/audit"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Action"
                      field="action"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/audit"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Tenant"
                      field="tenant"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/audit"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Details"
                      field="details"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/audit"
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
                        {formatWhen(row.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <p className="truncate font-medium text-ink">
                          {row.adminEmail ?? "Unknown admin"}
                        </p>
                      </td>
                      <td className="px-3 py-2 font-medium text-ink">
                        {formatAuditAction(row.action)}
                      </td>
                      <td className="px-3 py-2">
                        {row.targetBusinessId ? (
                          <Link
                            href={`/super-admin/businesses/${row.targetBusinessId}`}
                            className="block max-w-[180px] truncate font-medium text-brand-700 hover:underline"
                          >
                            {row.businessName ?? "Unknown tenant"}
                          </Link>
                        ) : (
                          <span className="text-[11px] text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-ink-muted">
                        {formatAuditDetails(row.action, row.diff)}
                      </td>
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
            basePath="/super-admin/audit"
            searchParams={hasListState ? listSearchParams : undefined}
            pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
            defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
          />
        </Section>
      </PageBody>
    </>
  );
}
