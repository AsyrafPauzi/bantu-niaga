import { describe, expect, it } from "vitest";
import { formatShiftDuration } from "@/lib/hr/shift-duration";

describe("formatShiftDuration", () => {
  it("formats hours and minutes from clock-in", () => {
    const start = new Date("2026-08-22T01:00:00.000Z");
    const until = new Date("2026-08-22T03:25:00.000Z");
    expect(formatShiftDuration(start.toISOString(), until)).toBe("2h 25m");
  });

  it("formats under one hour as minutes only", () => {
    const start = new Date("2026-08-22T01:00:00.000Z");
    const until = new Date("2026-08-22T01:40:00.000Z");
    expect(formatShiftDuration(start.toISOString(), until)).toBe("40m");
  });
});
