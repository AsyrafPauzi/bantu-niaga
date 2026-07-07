import { describe, expect, it } from "vitest";
import {
  employeeDocumentCreateSchema,
  employeeCreateSchema,
  holidayCreateSchema,
  leaveCreateSchema,
  leaveStatusUpdateSchema,
  appraisalCreateSchema,
  appraisalUpdateSchema,
  onboardingCreateSchema,
  onboardingStatusUpdateSchema,
} from "@/lib/hr/schemas";

describe("HR schemas", () => {
  it("accepts a minimal employee profile", () => {
    const parsed = employeeCreateSchema.parse({
      full_name: "Siti Aminah",
      employment_type: "full_time",
      role_title: "Supervisor",
      start_date: "2026-06-24",
    });

    expect(parsed.full_name).toBe("Siti Aminah");
    expect(parsed.status).toBe("active");
  });

  it("rejects leave where end date is before start date", () => {
    const result = leaveCreateSchema.safeParse({
      employee_id: "00000000-0000-0000-0000-000000000001",
      leave_type: "annual",
      start_date: "2026-06-25",
      end_date: "2026-06-24",
    });

    expect(result.success).toBe(false);
  });

  it("accepts approve and reject status updates", () => {
    expect(leaveStatusUpdateSchema.parse({ status: "approved" }).status).toBe(
      "approved",
    );
    expect(
      leaveStatusUpdateSchema.parse({
        status: "rejected",
        decision_note: "Insufficient balance",
      }).status,
    ).toBe("rejected");
  });

  it("accepts employee document, onboarding, and holiday core records", () => {
    const employeeId = "00000000-0000-0000-0000-000000000001";

    expect(
      employeeDocumentCreateSchema.parse({
        employee_id: employeeId,
        document_type: "ic",
        label: "IC front and back",
      }).document_type,
    ).toBe("ic");

    expect(
      onboardingCreateSchema.parse({
        employee_id: employeeId,
        label: "Collect signed contract",
      }).label,
    ).toBe("Collect signed contract");

    expect(onboardingStatusUpdateSchema.parse({ is_done: true }).is_done).toBe(
      true,
    );

    expect(
      holidayCreateSchema.parse({
        state_code: "KUL",
        holiday_date: "2026-08-31",
        name: "Hari Kebangsaan",
      }).name,
    ).toBe("Hari Kebangsaan");

    expect(
      appraisalCreateSchema.parse({
        employee_id: employeeId,
        period_label: "2026 Annual review",
        due_date: "2026-12-31",
      }).period_label,
    ).toBe("2026 Annual review");

    expect(
      appraisalUpdateSchema.parse({ status: "completed", rating: 4 }).rating,
    ).toBe(4);
  });
});
