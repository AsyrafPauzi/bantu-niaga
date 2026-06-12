// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SegmentDonut } from "@/components/marketing/dashboard/SegmentDonut";
import { SEGMENT_COLORS } from "@/lib/marketing/dashboard-colors";
import type { SegmentSlice } from "@/lib/marketing/dashboard-queries";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
      ResizeObserverStub;
  }
});

describe("<SegmentDonut>", () => {
  afterEach(() => cleanup());

  function makeSlices(): SegmentSlice[] {
    return [
      { segment: "vip",     label: "VIP",     count: 3, pct: 30,   color: SEGMENT_COLORS.vip },
      { segment: "repeat",  label: "Repeat",  count: 2, pct: 20,   color: SEGMENT_COLORS.repeat },
      { segment: "new",     label: "New",     count: 1, pct: 10,   color: SEGMENT_COLORS.new },
      { segment: "dormant", label: "Dormant", count: 3, pct: 30,   color: SEGMENT_COLORS.dormant },
      { segment: "at_risk", label: "At-risk", count: 1, pct: 10,   color: SEGMENT_COLORS.at_risk },
    ];
  }

  it("renders one legend row per segment", () => {
    const slices = makeSlices();
    const { container, getByTestId } = render(<SegmentDonut slices={slices} />);
    expect(getByTestId("segment-donut")).toBeTruthy();
    expect(getByTestId("segment-legend")).toBeTruthy();
    const items = container.querySelectorAll("[data-segment]");
    // 5 legend rows + cells from chart slices, but legend rows are <li data-segment="...">
    const legendRows = container.querySelectorAll("li[data-segment]");
    expect(legendRows.length).toBe(5);
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("colours the legend swatch for each segment using the brand palette", () => {
    const slices = makeSlices();
    const { container } = render(<SegmentDonut slices={slices} />);
    const swatches = container.querySelectorAll('[data-testid="segment-swatch"]');
    expect(swatches.length).toBe(5);
    const styleColor = (n: number) =>
      (swatches[n] as HTMLElement).style.backgroundColor;
    // VIP slice should use accent (the orange)
    const vipColor = styleColor(0);
    // dictated by SEGMENT_COLORS.vip = #F97316 → rgb(249, 115, 22)
    expect(vipColor).toContain("249");
  });

  it("renders the count + percentage for each segment", () => {
    const slices = makeSlices();
    const { container } = render(<SegmentDonut slices={slices} />);
    const text = container.textContent ?? "";
    expect(text).toContain("VIP");
    expect(text).toContain("Repeat");
    expect(text).toContain("Dormant");
    expect(text).toContain("30.0%");
    expect(text).toContain("10.0%");
  });

  it("shows the total count in the donut centre", () => {
    const slices = makeSlices();
    const { getByTestId } = render(<SegmentDonut slices={slices} />);
    const donut = getByTestId("segment-donut");
    expect(donut.textContent).toContain("10");
    expect(donut.textContent?.toLowerCase()).toContain("tagged");
  });
});
