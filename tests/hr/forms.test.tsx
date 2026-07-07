// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HrDocumentCreateForm } from "@/components/hr/HrDocumentCreateForm";
import { HrLeaveLinkActions } from "@/components/hr/HrLeaveLinkActions";
import { HrLeaveCreateForm } from "@/components/hr/HrLeaveCreateForm";
import type { HrEmployeeRow } from "@/lib/hr/load";

const refresh = vi.fn();

const employees: HrEmployeeRow[] = [
  {
    id: "employee-1",
    full_name: "Aisyah Rahman",
    employment_type: "full_time",
    role_title: "Cafe Supervisor",
    start_date: "2025-03-10",
    status: "active",
    phone_e164: "+60123456701",
    email: "aisyah@example.test",
    emergency_contact_name: null,
    emergency_contact_relationship: null,
    emergency_contact_phone: null,
    bank_name: null,
    bank_account_no: null,
    bank_account_holder: null,
    notes: null,
    created_at: "2026-06-01T00:00:00.000Z",
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("<HrLeaveCreateForm>", () => {
  afterEach(() => {
    cleanup();
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("records leave and resets the submitted form after the async request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HrLeaveCreateForm employees={employees} />);

    await userEvent.selectOptions(screen.getByLabelText(/Employee/i), "employee-1");
    await userEvent.type(screen.getByLabelText(/Start date/i), "2026-07-01");
    await userEvent.type(screen.getByLabelText(/End date/i), "2026-07-02");
    await userEvent.type(screen.getByLabelText(/Reason/i), "Family trip");
    await userEvent.click(screen.getByRole("button", { name: /Record AL leave/i }));

    expect(await screen.findByText("Leave recorded.")).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/hr/leave",
      expect.objectContaining({ method: "POST" }),
    );
    expect((screen.getByLabelText("Reason") as HTMLTextAreaElement).value).toBe("");
  });
});

describe("<HrDocumentCreateForm>", () => {
  afterEach(() => {
    cleanup();
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("uploads to Admin Storage and links the returned file to the HR document", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            upload_url: "https://storage.example.test/upload",
            storage_path: "business/file.pdf",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: { id: "admin-file-1" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ document: { id: "hr-doc-1" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<HrDocumentCreateForm employees={employees} />);

    await user.selectOptions(screen.getByLabelText("Employee"), "employee-1");
    await user.selectOptions(screen.getByLabelText("Document type"), "ic");
    await user.type(screen.getByLabelText("Document label"), "IC copy");
    const file = new File(["test"], "ic-copy.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText("Document file") as HTMLInputElement;
    await user.upload(fileInput, file);
    expect(fileInput.files?.[0]).toBe(file);
    await user.click(screen.getByRole("button", { name: "Add document record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText("Document uploaded and linked to employee.")).toBeTruthy();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/storage",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://storage.example.test/upload",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/admin/storage/confirm",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/hr/documents",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"admin_file_id":"admin-file-1"'),
      }),
    );
  });
});

describe("<HrLeaveLinkActions>", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("generates a staff leave link and shows copy/share actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          url: "https://app.example.test/staff/leave/token-123",
          employee: { full_name: "Aisyah Rahman" },
        }),
      }),
    );

    render(
      <HrLeaveLinkActions
        employeeId="00000000-0000-0000-0000-000000000123"
        employeeName="Aisyah Rahman"
        employeePhone="+60123456701"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Generate leave link" }));

    expect(await screen.findByText(/Expires in 24 hours/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Send WhatsApp" }).getAttribute("href"),
    ).toContain("https://wa.me/60123456701?text=");
  });
});
