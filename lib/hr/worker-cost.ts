import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parsePayslipMonth } from "@/lib/hr/payslips";

export interface WorkerCostRow {
  employee_id: string;
  full_name: string;
  role_title: string;
  employment_type: string;
  status: string;
  base_salary_myr: number | null;
  estimated_cost_myr: number;
}

export interface WorkerCostReport {
  month: string;
  period_label: string;
  rows: WorkerCostRow[];
  total_estimated_cost_myr: number;
  employees_with_salary: number;
  employees_without_salary: number;
}

function periodLabel(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

export async function loadWorkerCostReport(
  businessId: string,
  month: string,
): Promise<WorkerCostReport> {
  const normalizedMonth = parsePayslipMonth(month);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select(
      "id, full_name, role_title, employment_type, status, base_salary_myr",
    )
    .eq("business_id", businessId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows: WorkerCostRow[] = (data ?? []).map((row) => {
    const salary =
      row.base_salary_myr != null && row.base_salary_myr !== ""
        ? Number(row.base_salary_myr)
        : null;
    const estimated =
      salary != null && Number.isFinite(salary) && salary >= 0 ? salary : 0;
    return {
      employee_id: String(row.id),
      full_name: String(row.full_name),
      role_title: String(row.role_title),
      employment_type: String(row.employment_type),
      status: String(row.status),
      base_salary_myr: salary,
      estimated_cost_myr: estimated,
    };
  });

  const total = rows.reduce((sum, row) => sum + row.estimated_cost_myr, 0);
  const withSalary = rows.filter((row) => row.base_salary_myr != null).length;

  return {
    month: normalizedMonth,
    period_label: periodLabel(normalizedMonth),
    rows,
    total_estimated_cost_myr: Math.round(total * 100) / 100,
    employees_with_salary: withSalary,
    employees_without_salary: rows.length - withSalary,
  };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function fmtAmount(value: number | null): string {
  if (value == null) return "";
  return value.toFixed(2);
}

export function workerCostReportToCsv(report: WorkerCostReport): string {
  const lines = [
    "Employee,Role,Employment type,Base salary (MYR),Estimated monthly cost (MYR)",
  ];

  for (const row of report.rows) {
    lines.push(
      [
        csvEscape(row.full_name),
        csvEscape(row.role_title),
        csvEscape(row.employment_type.replace(/_/g, " ")),
        fmtAmount(row.base_salary_myr),
        row.estimated_cost_myr.toFixed(2),
      ].join(","),
    );
  }

  lines.push(
    ["Total", "", "", "", report.total_estimated_cost_myr.toFixed(2)].join(","),
  );
  lines.push("");
  lines.push(
    csvEscape(
      `Worker cost estimate for ${report.period_label}. Based on base salary only; not statutory payroll.`,
    ),
  );

  return lines.join("\n");
}
