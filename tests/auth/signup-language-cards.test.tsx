// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignupLanguageCards } from "@/components/auth/SignupLanguageCards";

afterEach(() => {
  cleanup();
});

describe("SignupLanguageCards", () => {
  it("has no language selected until the user picks one", () => {
    render(<SignupLanguageCards value={null} onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios.every((el) => (el as HTMLInputElement).checked)).toBe(false);
  });

  it("calls onChange with ms when Bahasa Melayu is chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SignupLanguageCards value={null} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: /Bahasa Melayu/i }));
    expect(onChange).toHaveBeenCalledWith("ms");
  });
});
