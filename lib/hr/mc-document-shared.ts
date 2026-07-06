export const MC_DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const MC_DOCUMENT_MAX_SIZE_LABEL = "2 MB";

const ALLOWED_MC_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
]);

const ALLOWED_MC_EXTENSIONS = new Set(["png", "jpg", "jpeg", "pdf"]);

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function inferMimeType(file: File): string {
  const declared = (file.type || "").toLowerCase().split(";")[0].trim();
  if (declared && ALLOWED_MC_MIME_TYPES.has(declared)) {
    return declared === "image/jpg" ? "image/jpeg" : declared;
  }

  switch (extensionOf(file.name)) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "pdf":
      return "application/pdf";
    default:
      return declared;
  }
}

export function validateMcDocumentFile(
  file: File | null | undefined,
  opts?: { required?: boolean },
):
  | { ok: true; file: File; mimeType: string }
  | { ok: false; message: string } {
  if (!file || file.size <= 0) {
    if (opts?.required) {
      return {
        ok: false,
        message: "Please upload your MC document (PNG, JPEG, or PDF).",
      };
    }
    return { ok: false, message: "No MC document provided." };
  }

  if (file.size > MC_DOCUMENT_MAX_BYTES) {
    return {
      ok: false,
      message: `File too large. Maximum file size is ${MC_DOCUMENT_MAX_SIZE_LABEL}.`,
    };
  }

  const mimeType = inferMimeType(file);
  const extension = extensionOf(file.name);

  if (
    !ALLOWED_MC_MIME_TYPES.has(mimeType) &&
    !ALLOWED_MC_EXTENSIONS.has(extension)
  ) {
    return {
      ok: false,
      message: "Only PNG, JPEG, or PDF files are allowed for MC upload.",
    };
  }

  return { ok: true, file, mimeType };
}
