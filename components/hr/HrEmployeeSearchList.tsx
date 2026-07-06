"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { HrPersonListRow } from "@/components/hr/layout/hr-person-list-row";
import type { HrEmployeeRow } from "@/lib/hr/load";

function employmentLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HrEmployeeSearchList({ employees }: { employees: HrEmployeeRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        e.role_title.toLowerCase().includes(q),
    );
  }, [employees, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E0D8] bg-white px-4 py-3 dark:border-hairline-dark dark:bg-panel-dark">
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-subtle" strokeWidth={2} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name to find someone…"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle dark:text-cream-100"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted dark:text-cream-400">
          {employees.length === 0
            ? "No employees yet. Add your first staff profile."
            : "No staff match your search."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((employee) => (
            <HrPersonListRow
              key={employee.id}
              id={employee.id}
              name={employee.full_name}
              roleLine={`${employee.role_title} · ${employmentLabel(employee.employment_type)}`}
              status={employee.status === "on_leave" ? "on_leave" : employee.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
