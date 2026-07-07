import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import { PageBody } from "@/components/super-admin/primitives";
import { ListPagination } from "@/components/ui/list-pagination";
import { parsePagination } from "@/lib/pagination";
import { FileClock } from "lucide-react";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
}

export default async function SuperAdminAudit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 25 });
  const svc = createServiceRoleClient();
  const { data, count } = await svc
    .from("super_admin_audit")
    .select(
      "id, admin_email, action, target_type, target_id, diff, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);

  const rows = (data ?? []) as AuditRow[];
  const total = count ?? rows.length;

  return (
    <>
      <PageTopbar
        title="Audit log"
        subtitle={`${total} platform-admin actions, cross-tenant`}
      />
      <PageBody>
        <div className="overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card">
          <div className="grid grid-cols-[140px_180px_180px_220px_1fr] gap-3 border-b border-cream-300 bg-cream-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            <span>When</span>
            <span>Admin</span>
            <span>Action</span>
            <span>Target</span>
            <span>Diff</span>
          </div>
          {rows.length === 0 ? (
            <div className="grid place-items-center px-5 py-12 text-center text-sm text-ink-muted">
              <FileClock className="mb-3 h-7 w-7 text-ink-subtle" />
              No platform-admin actions yet. Every super-admin mutation gets
              recorded here.
            </div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[140px_180px_180px_220px_1fr] items-start gap-3 border-b border-cream-300 px-5 py-3 last:border-b-0"
                >
                  <span className="text-[11px] text-ink-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <span className="truncate text-xs text-ink">
                    {r.admin_email ?? "—"}
                  </span>
                  <span className="truncate text-xs font-semibold text-ink">
                    {r.action}
                  </span>
                  <span className="truncate text-[11px] text-ink-muted">
                    {r.target_type ?? "—"}
                    {r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ""}
                  </span>
                  <code className="truncate font-mono text-[11px] text-ink-muted">
                    {r.diff ? JSON.stringify(r.diff) : "—"}
                  </code>
                </li>
              ))}
            </ul>
          )}
          <ListPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            basePath="/super-admin/audit"
          />
        </div>
      </PageBody>
    </>
  );
}
