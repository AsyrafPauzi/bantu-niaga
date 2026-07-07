import { describe, expect, it } from "vitest";
import type { HrDocumentRow, HrEmployeeRow } from "@/lib/hr/load";
import {
  getMissingCompulsoryDocuments,
  isEmployeeProfileIncomplete,
} from "@/lib/hr/profile-completion";

const baseEmployee: HrEmployeeRow = {
  id: "emp-1",
  full_name: "Aisyah Rahman",
  employment_type: "full_time",
  role_title: "Supervisor",
  start_date: "2025-01-01",
  status: "active",
  phone_e164: "+60123456701",
  email: "aisyah@example.test",
  emergency_contact_name: "Rahman",
  emergency_contact_relationship: "Father",
  emergency_contact_phone: "+60123456702",
  bank_name: "Maybank",
  bank_account_no: "123456",
  bank_account_holder: "Aisyah Rahman",
  notes: null,
  created_at: "2025-01-01T00:00:00Z",
};

const documents: HrDocumentRow[] = [
  {
    id: "doc-1",
    employee_id: "emp-1",
    document_type: "ic",
    label: "IC copy",
    admin_file_id: "file-1",
    created_at: "2025-01-02T00:00:00Z",
  },
  {
    id: "doc-2",
    employee_id: "emp-1",
    document_type: "bank",
    label: "Bank statement",
    admin_file_id: "file-2",
    created_at: "2025-01-02T00:00:00Z",
  },
];

describe("profile completion", () => {
  it("flags missing compulsory documents", () => {
    expect(getMissingCompulsoryDocuments(new Set(["ic", "bank"]))).toEqual([
      "contract",
    ]);
  });

  it("marks profile incomplete when contract document is missing", () => {
    expect(isEmployeeProfileIncomplete(baseEmployee, documents)).toBe(true);
  });

  it("marks profile complete when contact and compulsory docs are present", () => {
    const completeDocs: HrDocumentRow[] = [
      ...documents,
      {
        id: "doc-3",
        employee_id: "emp-1",
        document_type: "contract",
        label: "Contract",
        admin_file_id: "file-3",
        created_at: "2025-01-02T00:00:00Z",
      },
    ];
    expect(isEmployeeProfileIncomplete(baseEmployee, completeDocs)).toBe(false);
  });

  it("ignores document rows without a linked file", () => {
    const unlinked: HrDocumentRow[] = [
      {
        id: "doc-x",
        employee_id: "emp-1",
        document_type: "contract",
        label: "Contract pending",
        admin_file_id: null,
        created_at: "2025-01-02T00:00:00Z",
      },
      ...documents,
    ];
    expect(isEmployeeProfileIncomplete(baseEmployee, unlinked)).toBe(true);
  });
});
