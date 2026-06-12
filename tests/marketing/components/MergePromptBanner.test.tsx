// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MergePromptBanner } from "@/components/marketing/MergePromptBanner";

describe("<MergePromptBanner>", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders both CTAs and the existing customer name", () => {
    const onMerge = vi.fn();
    const onKeepSeparate = vi.fn();
    render(
      <MergePromptBanner
        existingCustomerId="cust_existing"
        existingName="Ali bin Abu"
        onMerge={onMerge}
        onKeepSeparate={onKeepSeparate}
      />,
    );
    expect(screen.getByText(/Ali bin Abu/)).toBeTruthy();
    expect(screen.getByText(/Merge into existing/)).toBeTruthy();
    expect(screen.getByText(/Keep separate/)).toBeTruthy();
  });

  it("fires onMerge when the merge button is clicked", () => {
    const onMerge = vi.fn();
    const onKeepSeparate = vi.fn();
    render(
      <MergePromptBanner
        existingCustomerId="cust_existing"
        existingName="Ali"
        onMerge={onMerge}
        onKeepSeparate={onKeepSeparate}
      />,
    );
    fireEvent.click(screen.getByText(/Merge into existing/));
    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onKeepSeparate).not.toHaveBeenCalled();
  });

  it("fires onKeepSeparate when the keep-separate button is clicked", () => {
    const onMerge = vi.fn();
    const onKeepSeparate = vi.fn();
    render(
      <MergePromptBanner
        existingCustomerId="cust_existing"
        existingName="Ali"
        onMerge={onMerge}
        onKeepSeparate={onKeepSeparate}
      />,
    );
    fireEvent.click(screen.getByText(/Keep separate/));
    expect(onKeepSeparate).toHaveBeenCalledTimes(1);
    expect(onMerge).not.toHaveBeenCalled();
  });

  it("disables both buttons when disabled prop is true", () => {
    const onMerge = vi.fn();
    const onKeepSeparate = vi.fn();
    render(
      <MergePromptBanner
        existingCustomerId="cust_existing"
        existingName="Ali"
        onMerge={onMerge}
        onKeepSeparate={onKeepSeparate}
        disabled
      />,
    );
    const mergeBtn = screen.getByText(/Merge into existing/) as HTMLButtonElement;
    const keepBtn = screen.getByText(/Keep separate/) as HTMLButtonElement;
    expect(mergeBtn.disabled).toBe(true);
    expect(keepBtn.disabled).toBe(true);
    fireEvent.click(mergeBtn);
    fireEvent.click(keepBtn);
    expect(onMerge).not.toHaveBeenCalled();
    expect(onKeepSeparate).not.toHaveBeenCalled();
  });

  it("exposes the existing-customer id as a data attribute for callers", () => {
    const { container } = render(
      <MergePromptBanner
        existingCustomerId="cust_existing_42"
        existingName="X"
        onMerge={vi.fn()}
        onKeepSeparate={vi.fn()}
      />,
    );
    const banner = container.querySelector('[role="alert"]');
    expect(banner?.getAttribute("data-existing-id")).toBe("cust_existing_42");
  });
});
