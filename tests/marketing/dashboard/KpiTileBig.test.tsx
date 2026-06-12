// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";

beforeAll(() => {
  // Recharts ResponsiveContainer relies on ResizeObserver — jsdom doesn't
  // provide one. We stub it so the sparkline path renders without
  // throwing; we don't assert on the rendered <svg> chart itself.
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

describe("<KpiTileBig>", () => {
  afterEach(() => cleanup());

  it("renders the label, value, and sublabel", () => {
    const { getByTestId, getByText } = render(
      <KpiTileBig
        label="Total customers"
        value="42"
        sublabel="Live records"
        tone="brand"
      />,
    );
    expect(getByTestId("kpi-label").textContent).toBe("Total customers");
    expect(getByTestId("kpi-value").textContent).toBe("42");
    expect(getByText("Live records")).toBeTruthy();
  });

  it("renders a positive delta with up direction and success colour", () => {
    const { getByTestId } = render(
      <KpiTileBig
        label="New this month"
        value="5"
        tone="success"
        delta={{ value: 3, display: "+3", label: "vs last month" }}
      />,
    );
    const delta = getByTestId("kpi-delta");
    expect(delta.getAttribute("data-direction")).toBe("up");
    expect(delta.className).toContain("text-status-success");
    expect(delta.textContent).toContain("+3");
  });

  it("renders a negative delta with down direction and danger colour", () => {
    const { getByTestId } = render(
      <KpiTileBig
        label="Total spend"
        value="RM 0"
        tone="accent"
        delta={{ value: -120.5, display: "−RM 120.50" }}
      />,
    );
    const delta = getByTestId("kpi-delta");
    expect(delta.getAttribute("data-direction")).toBe("down");
    expect(delta.className).toContain("text-status-danger");
  });

  it("applies the correct tone stripe class", () => {
    const { getByTestId, rerender } = render(
      <KpiTileBig label="L" value="1" tone="brand" />,
    );
    expect(getByTestId("kpi-stripe").className).toContain("bg-brand-500");
    rerender(<KpiTileBig label="L" value="1" tone="accent" />);
    expect(getByTestId("kpi-stripe").className).toContain("bg-accent-500");
    rerender(<KpiTileBig label="L" value="1" tone="success" />);
    expect(getByTestId("kpi-stripe").className).toContain("bg-status-success");
  });

  it("renders an inline sparkline when spark data is provided", () => {
    const { getByTestId } = render(
      <KpiTileBig
        label="L"
        value="3"
        tone="brand"
        spark={[
          { day: "2026-06-07", value: 0 },
          { day: "2026-06-08", value: 1 },
          { day: "2026-06-09", value: 2 },
        ]}
        sparkKey="test-tile"
      />,
    );
    // SparklineMini renders a wrapper with data-testid="kpi-sparkline"
    expect(getByTestId("kpi-sparkline")).toBeTruthy();
  });
});
