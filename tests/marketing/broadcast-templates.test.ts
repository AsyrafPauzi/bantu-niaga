import { describe, expect, it } from "vitest";
import { BROADCAST_MESSAGE_TEMPLATES } from "@/lib/marketing/broadcast-templates";
import { renderTemplate } from "@/lib/marketing/broadcasts-shared";

describe("broadcast templates", () => {
  it("includes BM and EN presets with placeholders", () => {
    const langs = new Set(BROADCAST_MESSAGE_TEMPLATES.map((t) => t.lang));
    expect(langs.has("en")).toBe(true);
    expect(langs.has("bm")).toBe(true);
    for (const t of BROADCAST_MESSAGE_TEMPLATES) {
      expect(t.body).toMatch(/\{first_name\}|\{name\}|\{coupon_code\}/);
    }
  });

  it("renders a win-back template", () => {
    const t = BROADCAST_MESSAGE_TEMPLATES.find((x) => x.id === "en-winback");
    expect(t).toBeTruthy();
    const out = renderTemplate(
      t!.body,
      { name: "Aisha Tan" },
      { code: "COMEBACK10" },
    );
    expect(out).toContain("Aisha");
    expect(out).toContain("COMEBACK10");
  });
});
