import { describe, expect, it } from "vitest";
import {
  partitionLeaveForDesk,
  selectExpiringContracts,
} from "@/lib/hr/desk";

describe("partitionLeaveForDesk", () => {
  it("puts covering-today leave in today and overlapping week in thisWeek", () => {
    const leaves = [
      {
        id: "1",
        start_date: "2026-08-20",
        end_date: "2026-08-20",
        status: "approved",
      },
      {
        id: "2",
        start_date: "2026-08-22",
        end_date: "2026-08-23",
        status: "approved",
      },
      {
        id: "3",
        start_date: "2026-09-01",
        end_date: "2026-09-02",
        status: "approved",
      },
      {
        id: "4",
        start_date: "2026-08-20",
        end_date: "2026-08-21",
        status: "pending",
      },
    ];
    const { today, thisWeek } = partitionLeaveForDesk(
      leaves,
      "2026-08-20",
      "2026-08-26",
    );
    expect(today.map((l) => l.id)).toEqual(["1"]);
    expect(thisWeek.map((l) => l.id).sort()).toEqual(["1", "2"]);
  });
});

describe("selectExpiringContracts", () => {
  it("returns contracts ending within 30 days inclusive", () => {
    const employees = [
      { id: "a", contract_end_date: "2026-08-25" },
      { id: "b", contract_end_date: "2026-10-01" },
      { id: "c", contract_end_date: null },
    ];
    const out = selectExpiringContracts(employees, "2026-08-20", 30);
    expect(out.map((d) => d.id)).toEqual(["a"]);
  });
});
