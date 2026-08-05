"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useTransition } from "react";

const KINDS = [
  { value: "all", label: "All types" },
  { value: "export", label: "Data export" },
  { value: "delete_user", label: "Account deletion" },
  { value: "delete_business", label: "Business closure" },
  { value: "consent_change", label: "Consent change" },
  { value: "rectify", label: "Rectification" },
  { value: "object", label: "Objection" },
] as const;

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_grace", label: "Awaiting grace" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function PrivacyFilterBar({
  initialQ,
  initialKind,
  initialStatus,
}: {
  initialQ: string;
  initialKind: string;
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
        router.push(`/super-admin/privacy?${next.toString()}`);
      });
    },
    [router, searchParams],
  );

  return (
    <form
      className="flex flex-col gap-2.5 rounded-xl border border-cream-300 bg-white p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        apply({
          q: String(fd.get("q") ?? ""),
          kind: String(fd.get("kind") ?? "all"),
          status: String(fd.get("status") ?? "all"),
        });
      }}
    >
      <div className="min-w-[240px] flex-1">
        <label
          htmlFor="privacy-q"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Search
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
          <input
            id="privacy-q"
            name="q"
            type="search"
            defaultValue={initialQ}
            placeholder="Tenant, user email, or reason…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      </div>

      <div className="w-full sm:w-40">
        <label
          htmlFor="privacy-kind"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Type
        </label>
        <select
          id="privacy-kind"
          name="kind"
          defaultValue={initialKind}
          className="mt-1.5 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {KINDS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-40">
        <label
          htmlFor="privacy-status"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Status
        </label>
        <select
          id="privacy-status"
          name="status"
          defaultValue={initialStatus}
          className="mt-1.5 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
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
        {(initialQ || initialKind !== "all" || initialStatus !== "all") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => router.push("/super-admin/privacy")}
            className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
