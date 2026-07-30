import { describe, expect, it } from "vitest";
import {
  isEmptyTaskDescription,
  plainTextFromTaskDescription,
  sanitizeTaskDescription,
} from "@/lib/admin/task-html";

describe("task-html", () => {
  it("sanitizes unsafe tags and attributes", () => {
    const dirty =
      '<p>Hello <strong>world</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>';
    const clean = sanitizeTaskDescription(dirty);
    expect(clean).toContain("<strong>world</strong>");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onerror");
  });

  it("allows safe links", () => {
    const html =
      '<p>See <a href="https://example.com">docs</a></p>';
    expect(sanitizeTaskDescription(html)).toContain('href="https://example.com"');
  });

  it("extracts plain text for previews", () => {
    expect(
      plainTextFromTaskDescription("<p>Pay <strong>supplier</strong> by Friday</p>"),
    ).toBe("Pay supplier by Friday");
  });

  it("detects empty descriptions", () => {
    expect(isEmptyTaskDescription(null)).toBe(true);
    expect(isEmptyTaskDescription("<p><br></p>")).toBe(true);
    expect(isEmptyTaskDescription("<p>Notes</p>")).toBe(false);
  });
});
