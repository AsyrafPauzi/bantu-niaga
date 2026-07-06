import { describe, expect, it } from "vitest";
import {
  MC_DOCUMENT_MAX_BYTES,
  MC_DOCUMENT_MAX_SIZE_LABEL,
  validateMcDocumentFile,
} from "@/lib/hr/mc-document-shared";

describe("validateMcDocumentFile", () => {
  it("accepts a small PDF", () => {
    const file = new File(["pdf"], "mc-slip.pdf", { type: "application/pdf" });
    const result = validateMcDocumentFile(file, { required: true });
    expect(result.ok).toBe(true);
  });

  it("rejects missing file when required", () => {
    const result = validateMcDocumentFile(null, { required: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("upload your MC document");
    }
  });

  it("rejects files over 2 MB", () => {
    const big = new Uint8Array(MC_DOCUMENT_MAX_BYTES + 1);
    const file = new File([big], "mc.png", { type: "image/png" });
    const result = validateMcDocumentFile(file, { required: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(MC_DOCUMENT_MAX_SIZE_LABEL);
    }
  });

  it("rejects unsupported file types", () => {
    const file = new File(["txt"], "notes.txt", { type: "text/plain" });
    const result = validateMcDocumentFile(file, { required: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("PNG, JPEG, or PDF");
    }
  });
});
