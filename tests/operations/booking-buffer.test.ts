import { describe, expect, it, vi } from "vitest";
import { findBookingConflicts } from "@/lib/operations/booking-buffer";

function mockSupabase(rows: Array<Record<string, unknown>>, bufferMinutes = 15) {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { buffer_minutes: bufferMinutes } }),
    then: undefined as unknown,
  };
  chain.then = undefined;

  const bookingsQuery = {
    ...chain,
    select: vi.fn().mockReturnValue({
      ...chain,
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: rows }).then(resolve),
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "operations_booking_resources") {
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }
      if (table === "operations_bookings") {
        return bookingsQuery;
      }
      return bookingsQuery;
    }),
  };
}

describe("findBookingConflicts", () => {
  it("returns empty when slot is clear", async () => {
    const supabase = mockSupabase([]);
    const conflicts = await findBookingConflicts(
      supabase as never,
      "biz-1",
      {
        resourceId: "res-1",
        startsAt: "2026-08-01T10:00:00.000Z",
        endsAt: "2026-08-01T11:00:00.000Z",
      },
    );
    expect(conflicts).toEqual([]);
  });

  it("detects overlap with buffer after existing booking", async () => {
    const supabase = mockSupabase([
      {
        id: "b1",
        number: "BKG-2026-0001",
        starts_at: "2026-08-01T09:00:00.000Z",
        ends_at: "2026-08-01T10:00:00.000Z",
        status: "confirmed",
      },
    ], 30);
    const conflicts = await findBookingConflicts(
      supabase as never,
      "biz-1",
      {
        resourceId: "res-1",
        startsAt: "2026-08-01T10:15:00.000Z",
        endsAt: "2026-08-01T11:00:00.000Z",
      },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.number).toBe("BKG-2026-0001");
  });
});
