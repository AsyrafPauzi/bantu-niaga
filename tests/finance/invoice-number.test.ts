import { describe, expect, it } from "vitest";
import {
  formatInvoiceNumber,
  invoiceNumberPattern,
  nextInvoiceSequenceFromNumbers,
  parseInvoiceSequence,
} from "@/lib/finance/invoice-number";

describe("invoice-number sequence", () => {
  const pattern = invoiceNumberPattern("INV", 2026);

  it("starts at 1 when empty", () => {
    expect(nextInvoiceSequenceFromNumbers([], pattern)).toBe(1);
    expect(formatInvoiceNumber("INV", 2026, 1)).toBe("INV-2026-0001");
  });

  it("uses numeric max, not lexicographic string order", () => {
    // Lexicographic DESC would pick "INV-2026-99" over "INV-2026-100"
    const numbers = [
      "INV-2026-0009",
      "INV-2026-0100",
      "INV-2026-99",
      "INV-2026-0014",
    ];
    expect(nextInvoiceSequenceFromNumbers(numbers, pattern)).toBe(101);
    expect(formatInvoiceNumber("INV", 2026, 101)).toBe("INV-2026-0101");
  });

  it("ignores other prefixes and malformed tails", () => {
    const numbers = [
      "QUO-2026-0099",
      "INV-2025-0500",
      "INV-2026-0012",
      "INV-2026-abc",
      "INV-2026-0012-extra",
    ];
    expect(nextInvoiceSequenceFromNumbers(numbers, pattern)).toBe(13);
  });

  it("parses padded and unpadded suffixes", () => {
    expect(parseInvoiceSequence("INV-2026-0115", pattern)).toBe(115);
    expect(parseInvoiceSequence("INV-2026-7", pattern)).toBe(7);
    expect(parseInvoiceSequence("QUO-2026-0001", pattern)).toBeNull();
  });
});
