"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useTransition } from "react";

const ROLES = [
  { value: "all", label: "All roles" },
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "hr_officer", label: "HR officer" },
  { value: "marketing_officer", label: "Marketing officer" },
  { value: "operations_officer", label: "Operations officer" },
  { value: "sales_rep", label: "Sales rep" },
  { value: "cashier", label: "Cashier" },
  { value: "staff", label: "Staff" },
] as const;

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
] as const;

export function UsersFilterBar({
  initialQ,
  initialRole,
  initialStatus,
}: {
  initialQ: string;
  initialRole: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "all") next.delete(key);
        else next.set(key, trimmed);
      }
      next.delete("page");
      startTransition(() => {
        router.push(`/super-admin/users?${next.toString()}`);
      });
    },
    [router, searchParams],
  );

  return (
    <form
      className="flex flex-col gap-2.5 rounded-xl border border-cream-300 bg-white p-3 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        apply({
          q: String(fd.get("q") ?? ""),
          role: String(fd.get("role") ?? "all"),
          status: String(fd.get("status") ?? "all"),
        });
      }}
    >
      <div className="min-w-[240px] flex-1">
        <label
          htmlFor="users-q"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Search
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
          <input
            id="users-q"
            name="q"
            type="search"
            defaultValue={initialQ}
            placeholder="Name, email, or tenant…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      </div>

      <div className="w-full sm:w-40">
        <label
          htmlFor="users-role"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Role
        </label>
        <select
          id="users-role"
          name="role"
          defaultValue={initialRole}
          className="mt-1.5 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-medium text-ink dark:bg-panel-dark dark:text-cream-100 dark:border-hairline-dark focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-40">
        <label
          htmlFor="users-status"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Status
        </label>
        <select
          id="users-status"
          name="status"
          defaultValue={initialStatus}
          className="mt-1.5 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-medium text-ink dark:bg-panel-dark dark:text-cream-100 dark:border-hairline-dark focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 sm:pb-0.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink-muted disabled:opacity-60"
        >
          Apply
        </button>
        {(initialQ || initialRole !== "all" || initialStatus !== "all") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => router.push("/super-admin/users")}
            className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-100 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60 disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
