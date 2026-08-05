import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { loadUsersPage, loadUsersSummary } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  formatInt,
} from "@/components/super-admin/primitives";
import {
  ImpersonateButton,
  UserRowMenu,
} from "@/components/super-admin/UserRowActions";
import { UsersFilterBar } from "@/components/super-admin/UsersFilterBar";
import { SortableTh } from "@/components/super-admin/SortableTh";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_PAGE_SIZE_OPTIONS,
  parsePagination,
  withPageSizeSearchParam,
} from "@/lib/pagination";
import { parseUsersSort } from "@/lib/super-admin/table-sort";
import { tierBy, type TierKey } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";

function initials(name: string | null, email: string | null): string {
  const source = (name && name.trim()) || email || "?";
  const parts = source
    .replace(/[^a-zA-Z ]/g, "")
    .trim()
    .split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function tierLabel(tier?: string): string {
  if (!tier) return "—";
  return tierBy(tier)?.label ?? tier;
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ");
}

function formatJoined(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return `${date} · today`;
  if (days === 1) return `${date} · 1d`;
  return `${date} · ${days}d`;
}

function compactStatus(suspended: boolean): React.ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
      <span
        className={`h-1.5 w-1.5 rounded-full ${suspended ? "bg-status-warning" : "bg-status-success"}`}
      />
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

function tierChip(tier?: string): React.ReactNode {
  const label = tierLabel(tier);
  return (
    <span className="text-[11px] font-medium text-ink-muted">{label}</span>
  );
}

function paramString(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SuperAdminUsers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
    allowedPageSizes: ADMIN_PAGE_SIZE_OPTIONS,
  });
  const sortState = parseUsersSort(params);
  const q = paramString(params.q);
  const role = paramString(params.role) || "all";
  const status = paramString(params.status) || "all";

  const [summary, { rows: users, total }] = await Promise.all([
    loadUsersSummary(),
    loadUsersPage({
      from: pagination.from,
      to: pagination.to,
      filters: {
        q: q || undefined,
        role,
        status: status as "all" | "active" | "suspended",
      },
      sort: sortState,
    }),
  ]);

  const filterActive = Boolean(q || role !== "all" || status !== "all");
  const listSearchParams = withPageSizeSearchParam(
    {
      q: q || undefined,
      role: role !== "all" ? role : undefined,
      status: status !== "all" ? status : undefined,
      sort: sortState.field !== "joined" ? sortState.field : undefined,
      order:
        sortState.field !== "joined" || sortState.order !== "desc"
          ? sortState.order
          : undefined,
    },
    pagination.pageSize,
  );
  const hasListState =
    filterActive ||
    sortState.field !== "joined" ||
    sortState.order !== "desc" ||
    pagination.pageSize !== ADMIN_DEFAULT_PAGE_SIZE;

  return (
    <>
      <PageTopbar
        title="Platform users"
        subtitle="Cross-tenant directory from users and businesses tables"
        right={
          <Link
            href="/super-admin/businesses"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            <Building2 className="h-3.5 w-3.5" />
            View tenants
          </Link>
        }
      />

      <PageBody>
        <div className="mb-3 grid grid-cols-4 gap-3">
          <KpiCard
            label="Total"
            value={formatInt(summary.total)}
            subtle="accounts"
            trend="flat"
          />
          <KpiCard
            label="Active"
            value={formatInt(summary.active)}
            trend="up"
          />
          <KpiCard
            label="Suspended"
            value={formatInt(summary.suspended)}
            trend={summary.suspended > 0 ? "down" : "flat"}
          />
          <KpiCard
            label="Owners"
            value={formatInt(summary.owners)}
            trend="flat"
          />
        </div>

        <Suspense
          fallback={
            <div className="h-[88px] animate-pulse rounded-xl border border-cream-300 bg-white" />
          }
        >
          <UsersFilterBar
            initialQ={q}
            initialRole={role}
            initialStatus={status}
          />
        </Suspense>

        <Section
          className="!p-4 !pb-0"
          title="User directory"
          description={
            filterActive
              ? `${formatInt(total)} matching`
              : `${formatInt(total)} users`
          }
        >
          {users.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">
              {filterActive
                ? "No users match your filters."
                : "No users yet. The first sign-up will appear here automatically."}
            </p>
          ) : (
            <div className="-mx-4 mt-3 overflow-x-auto border-t border-cream-200">
              <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <SortableTh
                      label="User"
                      field="name"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/users"
                      searchParams={listSearchParams}
                      className="px-4 py-2"
                    />
                    <SortableTh
                      label="Tenant"
                      field="tenant"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/users"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Role"
                      field="role"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/users"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Plan"
                      field="plan"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/users"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Status"
                      field="status"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/users"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <SortableTh
                      label="Joined"
                      field="joined"
                      currentSort={sortState.field}
                      currentOrder={sortState.order}
                      basePath="/super-admin/users"
                      searchParams={listSearchParams}
                      className="px-3 py-2"
                    />
                    <th className="px-4 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="align-middle hover:bg-cream-50/60"
                    >
                      <td className="px-4 py-2 pr-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800">
                            {initials(u.display_name, u.email)}
                          </div>
                          <div className="min-w-0 leading-tight">
                            <p className="truncate font-medium text-ink">
                              {u.display_name?.trim() || "Unnamed user"}
                            </p>
                            <p className="truncate text-[11px] text-ink-muted">
                              {u.email ?? "No email"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/super-admin/businesses/${u.business_id}`}
                          className="block max-w-[180px] truncate font-medium text-brand-700 hover:underline"
                        >
                          {u.business_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-2 capitalize text-ink-muted">
                        {formatRole(u.role)}
                      </td>
                      <td className="px-3 py-2">
                        {tierChip(u.business_tier as TierKey | undefined)}
                      </td>
                      <td className="px-3 py-2">
                        {compactStatus(u.is_suspended ?? false)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink-muted">
                        {formatJoined(u.created_at)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {!u.is_suspended ? (
                            <ImpersonateButton userId={u.id} compact />
                          ) : null}
                          <UserRowMenu
                            userId={u.id}
                            businessId={u.business_id}
                            email={u.email}
                            isSuspended={u.is_suspended ?? false}
                          />
                        </div>
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
            basePath="/super-admin/users"
            searchParams={hasListState ? listSearchParams : undefined}
            pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
            defaultPageSize={ADMIN_DEFAULT_PAGE_SIZE}
          />
        </Section>
      </PageBody>
    </>
  );
}
