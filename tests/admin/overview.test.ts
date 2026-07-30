import { describe, expect, it } from "vitest";
import {
  buildAdminChecklist,
  fileCategoryLabel,
  renewalsKpiCopy,
  taskDueLabel,
  taskDueTone,
} from "@/lib/admin/overview";

describe("admin overview helpers", () => {
  it("labels file categories for display", () => {
    expect(fileCategoryLabel("receipt")).toBe("Receipts");
    expect(fileCategoryLabel(null)).toBe("Uncategorised");
  });

  it("formats renewals KPI copy", () => {
    expect(renewalsKpiCopy(0, 0)).toEqual({
      value: "0",
      deltaTone: "success",
    });
    expect(renewalsKpiCopy(2, 1)).toEqual({
      value: "3",
      delta: "2 overdue · 1 due soon",
      deltaTone: "danger",
    });
  });

  it("highlights overdue and due-today tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.toISOString().slice(0, 10);
    expect(taskDueTone(y)).toBe("danger");
    expect(taskDueLabel(y)).toMatch(/overdue/);

    const today = new Date().toISOString().slice(0, 10);
    expect(taskDueTone(today)).toBe("warning");
    expect(taskDueLabel(today)).toBe("Due today");
  });

  it("builds checklist from empty admin state", () => {
    const items = buildAdminChecklist({
      fileCount: 0,
      openTaskCount: 0,
      complianceTotal: 0,
      complianceOverdue: 0,
      complianceDueSoon: 0,
      urgentComplianceTitle: null,
      dueThisWeekTaskTitle: null,
      canStorage: true,
      canTasks: true,
      canCompliance: true,
    });
    expect(items.some((i) => i.id === "add-ssm")).toBe(true);
    expect(items.some((i) => i.id === "upload-first")).toBe(true);
    expect(items.some((i) => i.id === "weekly-routine")).toBe(true);
  });

  it("prioritises overdue renewals in checklist", () => {
    const items = buildAdminChecklist({
      fileCount: 3,
      openTaskCount: 2,
      complianceTotal: 2,
      complianceOverdue: 1,
      complianceDueSoon: 0,
      urgentComplianceTitle: "SSM Renewal",
      dueThisWeekTaskTitle: null,
      canStorage: true,
      canTasks: true,
      canCompliance: true,
    });
    expect(items[0]?.id).toBe("renew-overdue");
    expect(items[0]?.label).toContain("SSM Renewal");
  });
});
