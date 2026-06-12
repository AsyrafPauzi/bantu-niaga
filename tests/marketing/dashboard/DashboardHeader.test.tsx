// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DashboardHeader } from "@/components/marketing/dashboard/DashboardHeader";

/**
 * MYT (UTC+8) hours we want to verify:
 *   - 02:00 MYT  → "Still up"
 *   - 08:00 MYT  → "Good morning"
 *   - 14:00 MYT  → "Good afternoon"
 *   - 19:00 MYT  → "Good evening"
 *   - 23:00 MYT  → "Good night"
 *
 * Pre-compute the equivalent UTC by subtracting 8 hours and pass via
 * the `now` prop so the test is timezone-independent.
 */
function mytAt(hour: number): Date {
  // 2026-06-15 hh:00 MYT → UTC = (hh - 8 mod 24) on potentially the
  // previous day. We anchor on a date far from DST edges.
  const utcHour = (hour - 8 + 24) % 24;
  const utcDay = hour < 8 ? 14 : 15;
  return new Date(Date.UTC(2026, 5, utcDay, utcHour, 0, 0));
}

describe("<DashboardHeader>", () => {
  afterEach(() => cleanup());

  it("greets 'Good morning' for an 08:00 MYT time", () => {
    const { getByTestId } = render(
      <DashboardHeader businessName="Kedai Hijau" now={mytAt(8)} />,
    );
    expect(getByTestId("dashboard-greeting").textContent).toContain(
      "Good morning",
    );
  });

  it("greets 'Good afternoon' for a 14:00 MYT time", () => {
    const { getByTestId } = render(
      <DashboardHeader businessName="Kedai Hijau" now={mytAt(14)} />,
    );
    expect(getByTestId("dashboard-greeting").textContent).toContain(
      "Good afternoon",
    );
  });

  it("greets 'Good evening' for a 19:00 MYT time", () => {
    const { getByTestId } = render(
      <DashboardHeader businessName="Kedai Hijau" now={mytAt(19)} />,
    );
    expect(getByTestId("dashboard-greeting").textContent).toContain(
      "Good evening",
    );
  });

  it("greets 'Good night' for a 23:00 MYT time", () => {
    const { getByTestId } = render(
      <DashboardHeader businessName="Kedai Hijau" now={mytAt(23)} />,
    );
    expect(getByTestId("dashboard-greeting").textContent).toContain(
      "Good night",
    );
  });

  it("greets 'Still up' before 05:00 MYT", () => {
    const { getByTestId } = render(
      <DashboardHeader businessName="Kedai Hijau" now={mytAt(2)} />,
    );
    expect(getByTestId("dashboard-greeting").textContent).toContain("Still up");
  });

  it("renders the business name when provided", () => {
    const { getByTestId } = render(
      <DashboardHeader businessName="Warung Cik Mah" now={mytAt(10)} />,
    );
    expect(getByTestId("dashboard-greeting").textContent).toContain(
      "Warung Cik Mah",
    );
  });

  it("falls back to a friendly placeholder when business name is empty", () => {
    const { getByTestId } = render(<DashboardHeader now={mytAt(10)} />);
    expect(getByTestId("dashboard-greeting").textContent).toContain(
      "your business",
    );
  });

  it("renders the optional summary line when provided", () => {
    const { container } = render(
      <DashboardHeader
        businessName="X"
        now={mytAt(10)}
        summary="42 customers · RM 1,200 lifetime spend"
      />,
    );
    expect(container.textContent).toContain("42 customers");
  });
});
