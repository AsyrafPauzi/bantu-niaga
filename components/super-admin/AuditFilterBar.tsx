"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useTransition } from "react";
import type { AuditCategory } from "@/lib/super-admin/audit-format";

const CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "all", label: "All areas" },
  { value: "user", label: "Users" },
  { value: "tenant", label: "Tenants" },
  { value: "integration", label: "Integrations" },
  { value: "marketplace", label: "Marketplace" },
  { value: "platform", label: "Platform admin" },
];

export function AuditFilterBar({
  initialQ,
  initialCategory,
}: {
  initialQ: string;
  initialCategory: string;
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
        router.push(`/super-admin/audit?${next.toString()}`);
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
          category: String(fd.get("category") ?? "all"),
        });
      }}
    >
      <div className="min-w-[240px] flex-1">
        <label
          htmlFor="audit-q"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Search
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
          <input
            id="audit-q"
            name="q"
            type="search"
            defaultValue={initialQ}
            placeholder="Admin email, action, or tenant…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      </div>

      <div className="w-full sm:w-44">
        <label
          htmlFor="audit-category"
          className="text-[10px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Area
        </label>
        <select
          id="audit-category"
          name="category"
          defaultValue={initialCategory}
          className="mt-1.5 w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {CATEGORIES.map((item) => (
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
        {(initialQ || initialCategory !== "all") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => router.push("/super-admin/audit")}
            className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
