import { describe, expect, it } from "vitest";
import {
  looksLikeStaffReport,
  sanitizeRewrittenCaption,
} from "@/lib/ai/maya-caption-sanitize";

describe("maya caption rewrite sanitize", () => {
  it("keeps a clean social caption", () => {
    const raw =
      "Nak Raya dah? Sambal nyet bilis kami ready — rasa pedas manis yang selalu terkenang.\n\nOrder sekarang, stok terhad!";
    expect(sanitizeRewrittenCaption(raw)).toContain("Sambal nyet bilis");
    expect(looksLikeStaffReport(raw)).toBe(false);
  });

  it("rejects Ringkasan-style staff reports", () => {
    const raw = `**Ringkasan**

Nak raya dah!

**Menu Hari Ini**
* Nasi Lemak — RM 12.00

**Jualan Bulan Ini**
RM 1,204.32

**Langkah Seterusnya**
Hubungi kami.`;
    expect(sanitizeRewrittenCaption(raw)).toBe("");
    expect(looksLikeStaffReport(raw)).toBe(true);
  });

  it("cuts caption before a leaked report section", () => {
    const raw = `Sambal nyet bilis memang sedap untuk Raya.

Jom order sekarang!

**Jualan Bulan Ini**
RM 999`;
    const out = sanitizeRewrittenCaption(raw);
    expect(out).toContain("Sambal nyet bilis");
    expect(out).not.toMatch(/Jualan/i);
  });
});
