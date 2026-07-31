import { describe, expect, it } from "vitest";
import {
  beautifyAssistantMarkdown,
  convertMarkdownTablesToBullets,
  fixBrokenBoldMarkdown,
  normalizeAssistantLinks,
  sanitizeAssistantReply,
} from "@/lib/ai/assistant-reply";

describe("sanitizeAssistantReply", () => {
  it("removes leaked monologue and repeated MTD blocks", () => {
    const raw = `**MTD Income**: RM 50,120.00
**MTD Expense**: RM 120.00
**Net Income**: RM 49, *I'll just say* → **RM 49, *no* → **RM 49, *okay* → **RM 49, *I'll just give the summary** | **MTD Income**: RM 50,120.00
**MTD Expense**: RM 120.00`;

    const out = sanitizeAssistantReply(raw);

    expect(out).toContain("RM 50,120.00");
    expect(out).not.toMatch(/\*I'll just say\*/i);
    expect(out).not.toMatch(/\*okay\*/i);
    expect((out.match(/\*\*MTD Income\*\*/g) ?? []).length).toBe(1);
  });

  it("dedupes identical paragraphs", () => {
    const raw = "Hello there.\n\nHello there.\n\nHello there.";
    expect(sanitizeAssistantReply(raw)).toBe("Hello there.");
  });

  it("preserves intentional paragraph breaks", () => {
    const raw = "Line one.\n\nLine two.";
    expect(sanitizeAssistantReply(raw)).toBe("Line one.\n\nLine two.");
  });
});

describe("beautifyAssistantMarkdown", () => {
  it("breaks glued expense confirmation sections", () => {
    const raw =
      "Entri berjaya dicatatkan! 📝 **Ringkasan transaksi baru:** - **Jumlah:** RM 50.00 - **Keterangan:** Pegi jumpa client - **Transaksi ID:** 222b5808-18c3-4e04-9841-649718774459 **Kesan ringkas ke kewangan hari ini:** - **MTD Expense:** RM 170.00 Anda boleh lihat entri ini di /finance/expenses.";

    const out = beautifyAssistantMarkdown(raw);

    expect(out).toContain("**Ringkasan transaksi baru:**\n\n- **Jumlah:**");
    expect(out).toContain("649718774459\n\n**Kesan ringkas");
    expect(out).toContain("[/finance/expenses](/finance/expenses)");
  });

  it("fixes nested duplicate markdown links", () => {
    const raw =
      "Lihat rekod di: [[/finance/customers](/finance/customers)](/finance/customers)";
    const out = normalizeAssistantLinks(raw);
    expect(out).toBe(
      "Lihat rekod di: [/finance/customers](/finance/customers)",
    );
  });

  it("does not double-wrap existing markdown links", () => {
    const raw = "Lihat [/finance/customers](/finance/customers) untuk senarai.";
    expect(normalizeAssistantLinks(raw)).toBe(raw);
  });

  it("fixes empty bold markers", () => {
    expect(fixBrokenBoldMarkdown("Good news — there are ** in your operations.")).toBe(
      "Good news — there are in your operations.",
    );
    expect(fixBrokenBoldMarkdown("**4 active products** ready")).toBe(
      "**4 active products** ready",
    );
  });

  it("converts markdown tables to bullet lines", () => {
    const table = `| Product ID | Product Name | Price | Category |
|------------|--------------|-------|----------|
| SNACK-KUIH | Kuih Lapis (2 pcs) | RM 4.00 | Snacks |
| NL-REG | Nasi Lemak Biasa | RM 8.50 | Food |`;

    const out = convertMarkdownTablesToBullets(table);
    expect(out).toContain("- `SNACK-KUIH`");
    expect(out).toContain("**Kuih Lapis (2 pcs)**");
    expect(out).toContain("RM 4.00");
    expect(out).not.toContain("|");
  });
});

describe("formatAssistantReply", () => {
  it("sanitizes then beautifies", () => {
    const raw =
      "Done. **Ringkasan:** - **Jumlah:** RM 10.00 - **Tarikh:** 2026-07-31";
    const out = beautifyAssistantMarkdown(sanitizeAssistantReply(raw));
    expect(out).toContain("\n- **Jumlah:**");
  });
});
