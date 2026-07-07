import { describe, expect, it } from "vitest";
import {
  appraisalDisplayStatus,
  appraisalStatusLabel,
} from "@/lib/hr/appraisal";

describe("appraisal display status", () => {
  it("marks completed appraisals", () => {
    expect(
      appraisalDisplayStatus(
        { status: "completed", due_date: "2026-01-01" },
        "2026-06-01",
      ),
    ).toBe("completed");
    expect(appraisalStatusLabel("completed")).toBe("Completed");
  });

  it("marks overdue pending appraisals", () => {
    expect(
      appraisalDisplayStatus(
        { status: "pending", due_date: "2026-01-01" },
        "2026-06-01",
      ),
    ).toBe("overdue");
  });

  it("marks future pending appraisals as due", () => {
    expect(
      appraisalDisplayStatus(
        { status: "pending", due_date: "2026-12-01" },
        "2026-06-01",
      ),
    ).toBe("pending");
    expect(appraisalStatusLabel("pending")).toBe("Due");
  });
});
