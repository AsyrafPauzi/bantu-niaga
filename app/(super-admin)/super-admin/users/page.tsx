import { Mail, UserPlus, Search } from "lucide-react";
import { loadUsers } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import { PageBody, StatusPill } from "@/components/super-admin/primitives";
import {
  ImpersonateButton,
  UserRowMenu,
} from "@/components/super-admin/UserRowActions";
import { tierBy } from "@/lib/settings/plans";

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

function roleChip(role: string): React.ReactNode {
  return (
    <span className="inline-flex rounded-md bg-cream-200 px-2 py-0.5 text-[11px] font-semibold capitalize text-ink">
      {role.replace("_", " ")}
    </span>
  );
}

function tierChip(tier?: string): React.ReactNode {
  const label = tierLabel(tier);
  const colors =
    tier === "enterprise"
      ? "bg-accent-100 text-accent-700"
      : tier === "sme"
        ? "bg-brand-100 text-brand-700"
        : tier === "micro"
          ? "bg-brand-50 text-brand-500"
          : "bg-status-warning/15 text-status-warning";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${colors}`}
    >
      {label}
    </span>
  );
}

function formatAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function SuperAdminUsers() {
  const users = await loadUsers();

  return (
    <>
      <PageTopbar
        title="Users"
        subtitle={`${users.length} loaded · across ${
          new Set(users.map((u) => u.business_id)).size
        } tenants`}
        right={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100">
              <Mail className="h-3.5 w-3.5" />
              Invite
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted">
              <UserPlus className="h-3.5 w-3.5" />
              Add user
            </button>
          </>
        }
      />

      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[320px] items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-subtle" />
            <input
              type="search"
              placeholder="Search by name, email or tenant…"
              className="w-full bg-transparent text-sm placeholder:text-ink-subtle focus:outline-none"
            />
          </div>
          <FilterChip label="Tenant: All" />
          <FilterChip label="Role: All" />
          <FilterChip label="Status: Active" />
        </div>

        <div className="overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card">
          <div className="grid grid-cols-[40px_280px_220px_120px_120px_140px_140px] gap-3 border-b border-cream-300 bg-cream-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            <span></span>
            <span>User</span>
            <span>Business</span>
            <span>Role</span>
            <span>Plan</span>
            <span>Joined</span>
            <span className="text-right">Actions</span>
          </div>

          <ul>
            {users.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-ink-muted">
                No users yet. The first sign-up will appear here automatically.
              </li>
            )}
            {users.map((u) => (
              <li
                key={u.id}
                className="grid grid-cols-[40px_280px_220px_120px_120px_140px_140px] items-center gap-3 border-b border-cream-300 px-5 py-3 last:border-b-0 hover:bg-cream-100/50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-cream-300"
                  aria-label="Select user"
                />
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                    {initials(u.display_name, u.email)}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold text-ink">
                      {u.display_name ?? "(no name)"}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">
                      {u.email ?? "—"}
                    </p>
                  </div>
                </div>
                <span className="truncate text-sm text-ink">
                  {u.business_name ?? "—"}
                </span>
                {roleChip(u.role)}
                {tierChip(u.business_tier)}
                <span className="text-xs text-ink-muted">
                  {formatAgo(u.created_at)}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  {u.is_suspended ? (
                    <StatusPill tone="warning" label="Suspended" />
                  ) : (
                    <ImpersonateButton userId={u.id} />
                  )}
                  <UserRowMenu
                    userId={u.id}
                    email={u.email}
                    isSuspended={u.is_suspended ?? false}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </PageBody>
    </>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-100"
    >
      {label}
    </button>
  );
}
