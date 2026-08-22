import { describe, expect, it } from "vitest";
import {
  findPeakWindow,
  suggestTimeFromHourMyt,
  utcHourToMyt,
} from "@/lib/social/audience-best-time";

describe("audience-best-time helpers", () => {
  it("converts UTC hour to MYT (+8)", () => {
    expect(utcHourToMyt(0)).toBe(8);
    expect(utcHourToMyt(16)).toBe(0);
    expect(utcHourToMyt(23)).toBe(7);
  });

  it("finds the densest 2-hour window", () => {
    const hourly: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourly[h] = 1;
    hourly[9] = 50;
    hourly[10] = 40;
    const peak = findPeakWindow(hourly);
    expect(peak?.startHourUtc).toBe(9);
    expect(peak?.endHourUtc).toBe(11);
  });

  it("formats suggest time", () => {
    expect(suggestTimeFromHourMyt(9)).toBe("09:00");
  });
});
