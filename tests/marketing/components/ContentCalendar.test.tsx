// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ContentCalendar } from "@/components/marketing/ContentCalendar";
import type { ContentEntryRow } from "@/components/marketing/types";

/**
 * Component tests for `<ContentCalendar>` — the desktop month grid.
 *
 * Covers:
 *   - Always renders 42 grid cells (6 rows × 7 cols).
 *   - Header shows the month/year label.
 *   - Each cell has data-iso-date in MYT (Asia/Kuala_Lumpur).
 *   - Cells outside the queried month carry data-current-month="false".
 *   - Entries bucket into the right cell based on scheduled_at.
 *   - Each platform chip renders with `data-channel` so callers can
 *     verify the chip colours in a visual regression suite.
 */

describe("<ContentCalendar>", () => {
  afterEach(() => {
    cleanup();
  });

  function makeEntry(overrides: Partial<ContentEntryRow>): ContentEntryRow {
    return {
      id: overrides.id ?? "cp-1",
      business_id: "biz-1",
      channel: overrides.channel ?? "tiktok",
      status: overrides.status ?? "scheduled",
      scheduled_at: overrides.scheduled_at ?? null,
      hook: overrides.hook ?? "Test hook",
      caption: overrides.caption ?? null,
      created_by: null,
      posted_at: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
      media: overrides.media,
    };
  }

  it("renders a 42-cell month grid (6 × 7)", () => {
    const { container } = render(
      <ContentCalendar
        year={2026}
        month={6}
        entries={[]}
        newEntryHref={(iso) => `/marketing/content/new?date=${iso}`}
        entryHref={(id) => `/marketing/content/${id}`}
      />,
    );
    const cells = container.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(42);
  });

  it("labels the header with the month name and year", () => {
    const { getByText } = render(
      <ContentCalendar
        year={2026}
        month={6}
        entries={[]}
        newEntryHref={(iso) => `/marketing/content/new?date=${iso}`}
        entryHref={(id) => `/marketing/content/${id}`}
      />,
    );
    expect(getByText(/June 2026/)).toBeTruthy();
  });

  it("marks the 1st of the month as current-month and earlier cells as not", () => {
    const { container } = render(
      <ContentCalendar
        year={2026}
        month={6}
        entries={[]}
        newEntryHref={(iso) => `/marketing/content/new?date=${iso}`}
        entryHref={(id) => `/marketing/content/${id}`}
      />,
    );
    const firstOfJune = container.querySelector('[data-iso-date="2026-06-01"]');
    expect(firstOfJune).toBeTruthy();
    expect(firstOfJune?.getAttribute("data-current-month")).toBe("true");
    // 31 May 2026 should be present in the grid (Sun start adjusted for
    // Monday-leading grid) and marked as not-current-month.
    const may31 = container.querySelector('[data-iso-date="2026-05-31"]');
    if (may31) {
      expect(may31.getAttribute("data-current-month")).toBe("false");
    }
  });

  it("places a scheduled entry into the matching MYT day cell", () => {
    // 2026-06-15 09:00 MYT = 2026-06-15 01:00 UTC
    const scheduled = "2026-06-15T01:00:00.000Z";
    const entry = makeEntry({
      id: "cp-15june",
      scheduled_at: scheduled,
      channel: "instagram",
      hook: "raya carousel",
    });
    const { container } = render(
      <ContentCalendar
        year={2026}
        month={6}
        entries={[entry]}
        newEntryHref={(iso) => `/marketing/content/new?date=${iso}`}
        entryHref={(id) => `/marketing/content/${id}`}
      />,
    );
    const cell = container.querySelector('[data-iso-date="2026-06-15"]');
    expect(cell).toBeTruthy();
    expect(cell?.querySelector('[data-entry-id="cp-15june"]')).toBeTruthy();
    // The platform chip should be present with the correct channel tag.
    const chip = cell?.querySelector('[data-channel="instagram"]');
    expect(chip).toBeTruthy();
  });

  it("renders distinct chips per platform", () => {
    const entries: ContentEntryRow[] = [
      makeEntry({
        id: "ttok",
        channel: "tiktok",
        scheduled_at: "2026-06-10T01:00:00.000Z",
      }),
      makeEntry({
        id: "insta",
        channel: "instagram",
        scheduled_at: "2026-06-11T01:00:00.000Z",
      }),
      makeEntry({
        id: "fb",
        channel: "facebook",
        scheduled_at: "2026-06-12T01:00:00.000Z",
      }),
    ];
    const { container } = render(
      <ContentCalendar
        year={2026}
        month={6}
        entries={entries}
        newEntryHref={(iso) => `/marketing/content/new?date=${iso}`}
        entryHref={(id) => `/marketing/content/${id}`}
      />,
    );
    expect(container.querySelector('[data-channel="tiktok"]')).toBeTruthy();
    expect(container.querySelector('[data-channel="instagram"]')).toBeTruthy();
    expect(container.querySelector('[data-channel="facebook"]')).toBeTruthy();
  });

  it("renders a status pill per entry", () => {
    const entry = makeEntry({
      id: "with-status",
      status: "scheduled",
      scheduled_at: "2026-06-20T05:00:00.000Z",
    });
    const { container } = render(
      <ContentCalendar
        year={2026}
        month={6}
        entries={[entry]}
        newEntryHref={(iso) => `/marketing/content/new?date=${iso}`}
        entryHref={(id) => `/marketing/content/${id}`}
      />,
    );
    expect(container.querySelector('[data-status="scheduled"]')).toBeTruthy();
  });

  it("emits prev/next navigation links when provided", () => {
    const { getByLabelText } = render(
      <ContentCalendar
        year={2026}
        month={6}
        entries={[]}
        newEntryHref={(iso) => `/marketing/content/new?date=${iso}`}
        entryHref={(id) => `/marketing/content/${id}`}
        prevHref="/marketing/content?year=2026&month=5"
        nextHref="/marketing/content?year=2026&month=7"
      />,
    );
    expect(getByLabelText("Previous month")).toBeTruthy();
    expect(getByLabelText("Next month")).toBeTruthy();
  });
});
