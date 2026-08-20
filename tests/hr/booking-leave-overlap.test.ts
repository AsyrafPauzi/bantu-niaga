import { describe, expect, it } from "vitest";
import {
  datesOverlapInclusive,
  filterOverlappingBookings,
} from "@/lib/hr/booking-leave-overlap";

describe("datesOverlapInclusive", () => {
  it("detects overlapping ranges", () => {
    expect(
      datesOverlapInclusive("2026-08-20", "2026-08-22", "2026-08-21", "2026-08-25"),
    ).toBe(true);
    expect(
      datesOverlapInclusive("2026-08-20", "2026-08-22", "2026-08-23", "2026-08-25"),
    ).toBe(false);
    expect(
      datesOverlapInclusive("2026-08-20", "2026-08-22", "2026-08-22", "2026-08-22"),
    ).toBe(true);
  });
});

describe("filterOverlappingBookings", () => {
  it("keeps open bookings that overlap leave dates", () => {
    const out = filterOverlappingBookings(
      [
        {
          id: "1",
          title: "Cut",
          startsAt: "2026-08-21T10:00:00+08:00",
          endsAt: "2026-08-21T11:00:00+08:00",
          status: "confirmed",
        },
        {
          id: "2",
          title: "Cancel me",
          startsAt: "2026-08-21T12:00:00+08:00",
          endsAt: "2026-08-21T13:00:00+08:00",
          status: "cancelled",
        },
        {
          id: "3",
          title: "Later",
          startsAt: "2026-08-25T10:00:00+08:00",
          endsAt: "2026-08-25T11:00:00+08:00",
          status: "held",
        },
      ],
      "2026-08-20",
      "2026-08-22",
    );
    expect(out.map((b) => b.id)).toEqual(["1"]);
  });
});
