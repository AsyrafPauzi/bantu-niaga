import { describe, expect, it } from "vitest";
import {
  annualIncomeTaxMyr,
  calculateMalaysiaStatutory,
  estimateMonthlyPcbMyr,
} from "@/lib/hr/malaysia-statutory";

describe("malaysia statutory", () => {
  it("applies 13% employer EPF at or below RM5,000", () => {
    const result = calculateMalaysiaStatutory(3500, { includePcb: false });
    expect(result.employee_deductions.find((d) => d.code === "epf_employee")?.amount_myr).toBe(
      385,
    );
    expect(
      result.employer_contributions.find((d) => d.code === "epf_employer")?.amount_myr,
    ).toBe(455);
  });

  it("applies 12% employer EPF above RM5,000", () => {
    const result = calculateMalaysiaStatutory(6500, { includePcb: false });
    expect(result.employee_deductions.find((d) => d.code === "epf_employee")?.amount_myr).toBe(
      715,
    );
    expect(
      result.employer_contributions.find((d) => d.code === "epf_employer")?.amount_myr,
    ).toBe(780);
  });

  it("caps SOCSO/EIS insured wage at RM6,000", () => {
    const result = calculateMalaysiaStatutory(8000, { includePcb: false });
    expect(result.insured_wage_myr).toBe(6000);
    const socsoEmp = result.employee_deductions.find(
      (d) => d.code === "socso_employee",
    )!.amount_myr;
    const eisEmp = result.employee_deductions.find(
      (d) => d.code === "eis_employee",
    )!.amount_myr;
    // Band mid at ceiling RM6,000 × rates
    expect(socsoEmp).toBe(30);
    expect(eisEmp).toBe(12);
  });

  it("computes progressive annual tax and monthly PCB estimate", () => {
    expect(annualIncomeTaxMyr(0)).toBe(0);
    expect(annualIncomeTaxMyr(5000)).toBe(0);
    // First RM5k @0 + next RM15k @1% = RM150
    expect(annualIncomeTaxMyr(20000)).toBe(150);

    const pcb = estimateMonthlyPcbMyr({
      monthlyGross: 6500,
      monthlyEpfEmployee: 715,
    });
    expect(pcb).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(pcb)).toBe(true);
  });

  it("returns net pay after employee deductions including PCB", () => {
    const result = calculateMalaysiaStatutory(3500, { includePcb: true });
    expect(result.net_pay_myr).toBe(
      Math.round((3500 - result.employee_total_myr) * 100) / 100,
    );
    expect(result.net_pay_myr).toBeLessThan(3500);
  });
});
