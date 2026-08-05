import { describe, expect, it } from "vitest";
import {
  canonicalHolidayName,
  dedupeHolidayRows,
  holidayDedupeKey,
} from "@/lib/hr/holiday-dedupe";

describe("holidayDedupeKey", () => {
  it("treats Hari Kebangsaan and National Day as the same slot", () => {
    const ms = holidayDedupeKey({
      holiday_date: "2026-08-31",
      name: "Hari Kebangsaan",
      state_code: "KUL",
    });
    const en = holidayDedupeKey({
      holiday_date: "2026-08-31",
      name: "National Day",
      state_code: null,
    });
    expect(ms).toBe(en);
  });

  it("treats Hari Malaysia and Malaysia Day as the same slot", () => {
    const ms = holidayDedupeKey({
      holiday_date: "2026-09-16",
      name: "Hari Malaysia",
      state_code: "KUL",
    });
    const en = holidayDedupeKey({
      holiday_date: "2026-09-16",
      name: "Malaysia Day",
      state_code: null,
    });
    expect(ms).toBe(en);
  });

  it("keeps different holidays on the same date separate", () => {
    const ft = holidayDedupeKey({
      holiday_date: "2026-02-01",
      name: "Federal Territory Day",
      state_code: "KUL",
    });
    const thaipusam = holidayDedupeKey({
      holiday_date: "2026-02-01",
      name: "Thaipusam",
      state_code: "KUL",
    });
    expect(ft).not.toBe(thaipusam);
  });
});

describe("dedupeHolidayRows", () => {
  it("keeps one English name when Malay and English rows exist", () => {
    const rows = dedupeHolidayRows([
      {
        id: "1",
        holiday_date: "2026-08-31",
        name: "Hari Kebangsaan",
        state_code: "KUL",
      },
      {
        id: "2",
        holiday_date: "2026-08-31",
        name: "National Day",
        state_code: null,
        external_id: "2026-hari-kebangsaan",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("National Day");
  });
});

describe("canonicalHolidayName", () => {
  it("flags national day as federal", () => {
    expect(canonicalHolidayName("National Day").federal).toBe(true);
  });
});
