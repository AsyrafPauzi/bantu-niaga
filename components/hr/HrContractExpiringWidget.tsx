"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { ContractExpiringEmployee } from "@/lib/hr/contract-reminders";
import { hrClasses } from "@/lib/hr/theme";
import { cn } from "@/lib/utils/cn";

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function HrContractExpiringWidget({
  employees,
}: {
  employees: ContractExpiringEmployee[];
}) {
  if (employees.length === 0) return null;

  return (
    <section
      className="overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/50 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20"
    >
      <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 px-3 py-2 sm:px-4 dark:border-amber-900/40">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className="h-4 w-4 text-amber-700 dark:text-amber-300"
            strokeWidth={2}
          />
          <div>
            <h2 className="text-sm font-semibold leading-tight text-amber-900 dark:text-amber-100">
              Contracts ending soon
            </h2>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              {employees.length} staff within 30 days
            </p>
          </div>
        </div>
        <Link
          href="/hr/employees"
          className={cn("shrink-0 text-xs font-semibold", hrClasses.link)}
        >
          Employees
        </Link>
      </div>
      <ul className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
        {employees.slice(0, 5).map((emp) => (
          <li
            key={emp.id}
            className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4"
          >
            <div className="min-w-0">
              <Link
                href={`/hr/employees/${emp.id}`}
                className="truncate text-sm font-semibold text-ink hover:text-brand-700 dark:text-cream-100 dark:hover:text-brand-200"
              >
                {emp.full_name}
              </Link>
              <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                {emp.role_title} · ends {fmtDate(emp.contract_end_date)}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tabular-nums",
                emp.daysUntil <= 7
                  ? "bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
                  : "bg-white/80 text-amber-800 dark:bg-panel-dark/80 dark:text-amber-200",
              )}
            >
              {daysLabel(emp.daysUntil)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
