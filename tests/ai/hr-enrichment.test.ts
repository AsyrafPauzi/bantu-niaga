import { describe, expect, it } from "vitest";
import {
  buildCoverWarningLines,
  buildLeaveCalendarLines,
  buildProfileGapLines,
} from "@/lib/ai/context/hr-enrichment";
import type { HrDocumentRow, HrEmployeeRow, HrLeaveRow } from "@/lib/hr/load";

describe("buildLeaveCalendarLines", () => {
  it("lists leave in the next 14 days", () => {
    const leave: HrLeaveRow[] = [
      {
        id: "1",
        employee_id: "e1",
        leave_type: "annual",
        start_date: "2026-08-10",
        end_date: "2026-08-12",
        reason: null,
        status: "approved",
        decision_note: null,
        created_at: "",
        hr_employees: { full_name: "Ali", role_title: "Staff" },
      },
    ];
    const lines = buildLeaveCalendarLines(leave, "2026-08-01");
    expect(lines[0]).toContain("Ali");
    expect(lines[0]).toContain("annual");
  });
});

describe("buildCoverWarningLines", () => {
  it("flags when two staff are away the same day", () => {
    const leave: HrLeaveRow[] = [
      {
        id: "1",
        employee_id: "e1",
        leave_type: "annual",
        start_date: "2026-08-05",
        end_date: "2026-08-05",
        reason: null,
        status: "approved",
        decision_note: null,
        created_at: "",
        hr_employees: { full_name: "Ali", role_title: "Staff" },
      },
      {
        id: "2",
        employee_id: "e2",
        leave_type: "mc",
        start_date: "2026-08-05",
        end_date: "2026-08-05",
        reason: null,
        status: "approved",
        decision_note: null,
        created_at: "",
        hr_employees: { full_name: "Siti", role_title: "Staff" },
      },
    ];
    const lines = buildCoverWarningLines(leave, "2026-08-01");
    expect(lines.some((l) => l.includes("Cover risk"))).toBe(true);
    expect(lines[0]).toContain("Ali");
    expect(lines[0]).toContain("Siti");
  });
});

describe("buildProfileGapLines", () => {
  it("describes missing profile fields", () => {
    const emp = {
      id: "e1",
      full_name: "Ali",
      status: "active",
      phone_e164: null,
      emergency_contact_name: null,
      bank_name: null,
      bank_account_no: null,
    } as HrEmployeeRow;
    const docs: HrDocumentRow[] = [];
    const lines = buildProfileGapLines([emp], docs, 3);
    expect(lines[0]).toContain("Ali");
    expect(lines[0]).toContain("missing");
  });
});
