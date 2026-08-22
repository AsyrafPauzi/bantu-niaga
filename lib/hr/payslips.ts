import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateMalaysiaStatutory,
  type EmployerStatutoryLine,
} from "@/lib/hr/malaysia-statutory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PayslipDeduction {
  label: string;
  amount_myr: number;
}

export interface HrPayslipRow {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  gross_myr: number;
  deductions: PayslipDeduction[];
  employer_contributions: EmployerStatutoryLine[];
  net_myr: number;
  created_at: string;
  hr_employees?: {
    full_name: string;
    role_title: string;
    employee_number?: string | null;
  } | null;
}

const PAYSLIP_SELECT =
  "id, employee_id, period_start, period_end, gross_myr, deductions, employer_contributions, net_myr, created_at, " +
  "hr_employees(full_name, role_title, employee_number)";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parsePayslipMonth(month: string): string {
  if (!MONTH_RE.test(month)) {
    throw new Error("invalid_month");
  }
  return month;
}

export function monthToPeriod(month: string): {
  period_start: string;
  period_end: string;
} {
  const normalized = parsePayslipMonth(month);
  const [yearStr, monthStr] = normalized.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return {
    period_start: `${normalized}-01`,
    period_end: `${normalized}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function formatPayslipPeriodLabel(periodStart: string): string {
  return new Date(`${periodStart}T12:00:00`).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function parseDeductions(value: unknown): PayslipDeduction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = (row as { label?: unknown }).label;
      const amount = (row as { amount_myr?: unknown }).amount_myr;
      if (typeof label !== "string" || !label.trim()) return null;
      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum < 0) return null;
      return { label: label.trim(), amount_myr: amountNum };
    })
    .filter((row): row is PayslipDeduction => row != null);
}

function parseEmployerContributions(value: unknown): EmployerStatutoryLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = (row as { label?: unknown }).label;
      const amount = (row as { amount_myr?: unknown }).amount_myr;
      const code = (row as { code?: unknown }).code;
      if (typeof label !== "string" || !label.trim()) return null;
      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum < 0) return null;
      const codeStr =
        typeof code === "string" && code.trim()
          ? (code as EmployerStatutoryLine["code"])
          : ("epf_employer" as const);
      return {
        code: codeStr,
        label: label.trim(),
        amount_myr: amountNum,
      };
    })
    .filter((row): row is EmployerStatutoryLine => row != null);
}

function mapPayslipRow(row: Record<string, unknown>): HrPayslipRow {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    gross_myr: Number(row.gross_myr),
    deductions: parseDeductions(row.deductions),
    employer_contributions: parseEmployerContributions(
      row.employer_contributions,
    ),
    net_myr: Number(row.net_myr),
    created_at: String(row.created_at),
    hr_employees: (row.hr_employees as HrPayslipRow["hr_employees"]) ?? null,
  };
}

function sumDeductions(deductions: PayslipDeduction[]): number {
  return deductions.reduce((sum, row) => sum + row.amount_myr, 0);
}

export async function listHrPayslips(
  businessId: string,
  options?: { employeeId?: string; limit?: number },
): Promise<HrPayslipRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("hr_payslips")
    .select(PAYSLIP_SELECT)
    .eq("business_id", businessId)
    .order("period_start", { ascending: false })
    .limit(options?.limit ?? 200);

  if (options?.employeeId) {
    query = query.eq("employee_id", options.employeeId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapPayslipRow(row as unknown as Record<string, unknown>),
  );
}

export async function listHrPayslipsPage(
  businessId: string,
  options: {
    employeeId: string;
    year?: number | "all";
    from: number;
    to: number;
  },
): Promise<{ rows: HrPayslipRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("hr_payslips")
    .select(PAYSLIP_SELECT, { count: "exact" })
    .eq("business_id", businessId)
    .eq("employee_id", options.employeeId)
    .order("period_start", { ascending: false })
    .range(options.from, options.to);

  if (typeof options.year === "number" && Number.isFinite(options.year)) {
    const start = `${options.year}-01-01`;
    const end = `${options.year}-12-31`;
    query = query.gte("period_start", start).lte("period_start", end);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map((row) =>
      mapPayslipRow(row as unknown as Record<string, unknown>),
    ),
    total: count ?? data?.length ?? 0,
  };
}

export async function loadHrPayslip(
  businessId: string,
  payslipId: string,
): Promise<HrPayslipRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_payslips")
    .select(PAYSLIP_SELECT)
    .eq("business_id", businessId)
    .eq("id", payslipId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapPayslipRow(data as unknown as Record<string, unknown>);
}

export async function createHrPayslip(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    employeeId: string;
    month: string;
    createdBy: string;
    deductions?: PayslipDeduction[];
    /** When true (default), auto-apply MY EPF/SOCSO/EIS/PCB. */
    applyStatutory?: boolean;
  },
): Promise<HrPayslipRow> {
  const { period_start, period_end } = monthToPeriod(input.month);

  const { data: employee, error: employeeError } = await supabase
    .from("hr_employees")
    .select("id, full_name, role_title, employee_number, base_salary_myr")
    .eq("business_id", input.businessId)
    .eq("id", input.employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);
  if (!employee) {
    throw new Error("employee_not_found");
  }

  const gross =
    employee.base_salary_myr != null && employee.base_salary_myr !== ""
      ? Number(employee.base_salary_myr)
      : null;
  if (gross == null || !Number.isFinite(gross) || gross < 0) {
    throw new Error("salary_not_set");
  }

  const applyStatutory = input.applyStatutory !== false;
  let deductions = input.deductions ?? [];
  let employer_contributions: EmployerStatutoryLine[] = [];

  if (applyStatutory && deductions.length === 0) {
    const statutory = calculateMalaysiaStatutory(gross, { includePcb: true });
    deductions = statutory.employee_deductions.map((row) => ({
      label: row.label,
      amount_myr: row.amount_myr,
    }));
    employer_contributions = statutory.employer_contributions;
  }

  const deductionTotal = sumDeductions(deductions);
  const net = Math.max(0, Math.round((gross - deductionTotal) * 100) / 100);

  const { data: existing } = await supabase
    .from("hr_payslips")
    .select("id")
    .eq("business_id", input.businessId)
    .eq("employee_id", input.employeeId)
    .eq("period_start", period_start)
    .maybeSingle();

  if (existing) {
    throw new Error("duplicate_period");
  }

  const { data, error } = await supabase
    .from("hr_payslips")
    .insert({
      business_id: input.businessId,
      employee_id: input.employeeId,
      period_start,
      period_end,
      gross_myr: gross,
      deductions,
      employer_contributions,
      net_myr: net,
      created_by: input.createdBy,
    })
    .select(PAYSLIP_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapPayslipRow(data as unknown as Record<string, unknown>);
}
