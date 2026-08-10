/**
 * Malaysia statutory payroll contributions (KWSP / PERKESO / LHDN).
 *
 * Rates aligned to 2025–2026 employer guidance:
 * - EPF (KWSP): employee 11%; employer 13% (wages ≤ RM5,000) or 12% (> RM5,000)
 * - SOCSO Category 1 (under 60): employee ~0.5%, employer ~1.75%, wage ceiling RM6,000
 * - EIS (SIP): 0.2% each, wage ceiling RM6,000
 * - PCB (MTD): progressive YA rates with RM9,000 personal relief + EPF relief cap RM4,000
 *
 * SOCSO/EIS amounts use official-style RM100 wage bands (rounded) up to the ceiling.
 * Remit using KWSP Third Schedule / PERKESO ASSIST / LHDN e-PCB for filing.
 */

export const MY_STATUTORY_YEAR = 2026;
export const SOCSO_EIS_WAGE_CEILING_MYR = 6000;
export const EPF_EMPLOYER_THRESHOLD_MYR = 5000;
export const EPF_EMPLOYEE_RATE = 0.11;
export const EPF_EMPLOYER_RATE_LOW = 0.13;
export const EPF_EMPLOYER_RATE_HIGH = 0.12;
export const SOCSO_EMPLOYEE_RATE = 0.005;
export const SOCSO_EMPLOYER_RATE = 0.0175;
export const EIS_RATE = 0.002;
export const PERSONAL_RELIEF_MYR = 9000;
export const EPF_TAX_RELIEF_CAP_MYR = 4000;
export const TAX_REBATE_CHARGEABLE_LIMIT_MYR = 35000;
export const TAX_REBATE_MYR = 400;

export interface StatutoryLine {
  code: "epf_employee" | "socso_employee" | "eis_employee" | "pcb";
  label: string;
  amount_myr: number;
}

export interface EmployerStatutoryLine {
  code: "epf_employer" | "socso_employer" | "eis_employer";
  label: string;
  amount_myr: number;
}

export interface MalaysiaStatutoryResult {
  year: number;
  gross_myr: number;
  insured_wage_myr: number;
  employee_deductions: StatutoryLine[];
  employer_contributions: EmployerStatutoryLine[];
  employee_total_myr: number;
  employer_total_myr: number;
  net_pay_myr: number;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mid-band wage used for PERKESO-style band lookup (RM100 bands). */
function bandMidWage(wage: number, ceiling: number): number {
  const capped = Math.min(Math.max(wage, 0), ceiling);
  if (capped <= 0) return 0;
  const band = Math.ceil(capped / 100) * 100;
  return Math.min(band, ceiling);
}

function bandContribution(wage: number, rate: number, ceiling: number): number {
  if (wage <= 0) return 0;
  const mid = bandMidWage(wage, ceiling);
  return roundMoney(mid * rate);
}

/**
 * Progressive resident tax (YA 2025/2026 schedule) on annual chargeable income.
 */
export function annualIncomeTaxMyr(chargeableAnnual: number): number {
  if (chargeableAnnual <= 0) return 0;
  const brackets: Array<{ upTo: number; rate: number }> = [
    { upTo: 5_000, rate: 0 },
    { upTo: 20_000, rate: 0.01 },
    { upTo: 35_000, rate: 0.03 },
    { upTo: 50_000, rate: 0.06 },
    { upTo: 70_000, rate: 0.11 },
    { upTo: 100_000, rate: 0.19 },
    { upTo: 400_000, rate: 0.25 },
    { upTo: 600_000, rate: 0.26 },
    { upTo: 2_000_000, rate: 0.28 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    const slice = Math.min(chargeableAnnual, b.upTo) - prev;
    if (slice <= 0) break;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  return roundMoney(tax);
}

/** Monthly PCB estimate for a resident employee with no TP1 dependents. */
export function estimateMonthlyPcbMyr(opts: {
  monthlyGross: number;
  monthlyEpfEmployee: number;
}): number {
  const annualGross = opts.monthlyGross * 12;
  const annualEpf = Math.min(
    opts.monthlyEpfEmployee * 12,
    EPF_TAX_RELIEF_CAP_MYR,
  );
  const chargeable = Math.max(
    0,
    annualGross - PERSONAL_RELIEF_MYR - annualEpf,
  );
  let tax = annualIncomeTaxMyr(chargeable);
  if (chargeable <= TAX_REBATE_CHARGEABLE_LIMIT_MYR) {
    tax = Math.max(0, tax - TAX_REBATE_MYR);
  }
  return roundMoney(tax / 12);
}

export function calculateMalaysiaStatutory(
  monthlyGross: number,
  options?: { includePcb?: boolean },
): MalaysiaStatutoryResult {
  const gross = roundMoney(Math.max(0, monthlyGross));
  const includePcb = options?.includePcb !== false;
  const insured = Math.min(gross, SOCSO_EIS_WAGE_CEILING_MYR);

  const epfEmployee = roundMoney(gross * EPF_EMPLOYEE_RATE);
  const epfEmployer = roundMoney(
    gross *
      (gross <= EPF_EMPLOYER_THRESHOLD_MYR
        ? EPF_EMPLOYER_RATE_LOW
        : EPF_EMPLOYER_RATE_HIGH),
  );

  const socsoEmployee = bandContribution(
    gross,
    SOCSO_EMPLOYEE_RATE,
    SOCSO_EIS_WAGE_CEILING_MYR,
  );
  const socsoEmployer = bandContribution(
    gross,
    SOCSO_EMPLOYER_RATE,
    SOCSO_EIS_WAGE_CEILING_MYR,
  );
  const eisEmployee = bandContribution(
    gross,
    EIS_RATE,
    SOCSO_EIS_WAGE_CEILING_MYR,
  );
  const eisEmployer = bandContribution(
    gross,
    EIS_RATE,
    SOCSO_EIS_WAGE_CEILING_MYR,
  );

  const pcb = includePcb
    ? estimateMonthlyPcbMyr({
        monthlyGross: gross,
        monthlyEpfEmployee: epfEmployee,
      })
    : 0;

  const employee_deductions: StatutoryLine[] = [
    {
      code: "epf_employee",
      label: `EPF employee ${Math.round(EPF_EMPLOYEE_RATE * 100)}% (KWSP)`,
      amount_myr: epfEmployee,
    },
    {
      code: "socso_employee",
      label: "SOCSO employee (Cat. 1)",
      amount_myr: socsoEmployee,
    },
    {
      code: "eis_employee",
      label: "EIS employee 0.2%",
      amount_myr: eisEmployee,
    },
  ];
  if (includePcb && pcb > 0) {
    employee_deductions.push({
      code: "pcb",
      label: "PCB / MTD (LHDN estimate)",
      amount_myr: pcb,
    });
  }

  const employer_contributions: EmployerStatutoryLine[] = [
    {
      code: "epf_employer",
      label: `EPF employer ${
        gross <= EPF_EMPLOYER_THRESHOLD_MYR
          ? Math.round(EPF_EMPLOYER_RATE_LOW * 100)
          : Math.round(EPF_EMPLOYER_RATE_HIGH * 100)
      }% (KWSP)`,
      amount_myr: epfEmployer,
    },
    {
      code: "socso_employer",
      label: "SOCSO employer (Cat. 1)",
      amount_myr: socsoEmployer,
    },
    {
      code: "eis_employer",
      label: "EIS employer 0.2%",
      amount_myr: eisEmployer,
    },
  ];

  const employee_total_myr = roundMoney(
    employee_deductions.reduce((s, r) => s + r.amount_myr, 0),
  );
  const employer_total_myr = roundMoney(
    employer_contributions.reduce((s, r) => s + r.amount_myr, 0),
  );

  return {
    year: MY_STATUTORY_YEAR,
    gross_myr: gross,
    insured_wage_myr: insured,
    employee_deductions,
    employer_contributions,
    employee_total_myr,
    employer_total_myr,
    net_pay_myr: roundMoney(Math.max(0, gross - employee_total_myr)),
  };
}
