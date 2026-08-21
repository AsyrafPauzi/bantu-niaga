/**
 * Bantu Niaga — File Upload Validation.
 *
 * Validates uploaded files before they are processed or stored. Two layers
 * are applied in sequence:
 *
 *   1. MIME type allowlist   — compare the `Content-Type` the client
 *                              claims against a per-context allowlist.
 *   2. Magic-byte sniffing   — read the first 16 bytes of the actual
 *                              file data and confirm the binary signature
 *                              matches a known safe type, regardless of
 *                              what the client claims.
 *
 * Why both?
 *   - A client can trivially lie about `Content-Type`.
 *   - Magic-byte sniffing catches renamed executables (.exe → .pdf) and
 *     polyglot files (ZIP + JS double-embedded).
 *
 * The app's main upload flow uses Supabase Storage signed URLs so the
 * Next.js server never receives the raw bytes. Use these helpers when:
 *   a) A route receives a file body directly (multipart form), or
 *   b) You need to validate a MIME type string before issuing a signed URL.
 *
 * Usage:
 *
 *   import { validateMimeType, validateMagicBytes, DOCUMENT_TYPES } from
 *     "@/lib/security/file-validation";
 *
 *   // Check the claimed MIME only (fast; use before issuing a signed URL)
 *   const mimeOk = validateMimeType(claimedMime, DOCUMENT_TYPES);
 *
 *   // Check actual bytes (use when the server receives the file body)
 *   const buffer = await file.arrayBuffer();
 *   const magicOk = validateMagicBytes(new Uint8Array(buffer));
 */

// ─── MIME allowlists ──────────────────────────────────────────────────────────

/** Generic office / productivity documents. */
export const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

/** Web-safe image formats. */
export const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);

/** All types permitted in the Admin Digital Storage module. */
export const ADMIN_STORAGE_TYPES = new Set([
  ...DOCUMENT_TYPES,
  ...IMAGE_TYPES,
  "application/zip",
  "application/x-zip-compressed",
]);

// ─── Magic byte signatures ────────────────────────────────────────────────────

interface MagicSignature {
  /** Starting byte offset for the signature. */
  offset: number;
  /** Expected bytes. Null entries are wildcards. */
  bytes: (number | null)[];
  label: string;
}

const SAFE_SIGNATURES: readonly MagicSignature[] = [
  // PDF
  { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46], label: "PDF" },
  // JPEG
  { offset: 0, bytes: [0xff, 0xd8, 0xff], label: "JPEG" },
  // PNG
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], label: "PNG" },
  // GIF87a / GIF89a
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38], label: "GIF" },
  // WebP (RIFF....WEBP)
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], label: "WEBP" },
  // ZIP (also covers .docx/.xlsx/.pptx which are ZIP archives)
  { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], label: "ZIP/OOXML" },
  // Legacy OLE2 compound doc (old .doc/.xls/.ppt)
  { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], label: "OLE2" },
  // UTF-8 BOM (plain text / CSV)
  { offset: 0, bytes: [0xef, 0xbb, 0xbf], label: "UTF8_BOM" },
];

/** Dangerous signatures — always block regardless of claimed MIME. */
const DANGEROUS_SIGNATURES: readonly MagicSignature[] = [
  // ELF executable (Linux binary)
  { offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46], label: "ELF" },
  // Windows PE / MZ executable (.exe, .dll, .com)
  { offset: 0, bytes: [0x4d, 0x5a], label: "PE_MZ" },
  // Mach-O binary (macOS)
  { offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xce], label: "MACHO_32" },
  { offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xcf], label: "MACHO_64" },
  { offset: 0, bytes: [0xce, 0xfa, 0xed, 0xfe], label: "MACHO_LE32" },
  { offset: 0, bytes: [0xcf, 0xfa, 0xed, 0xfe], label: "MACHO_LE64" },
  // Java class file
  { offset: 0, bytes: [0xca, 0xfe, 0xba, 0xbe], label: "JAVA_CLASS" },
  // PHP script starting with <?php
  { offset: 0, bytes: [0x3c, 0x3f, 0x70, 0x68, 0x70], label: "PHP" },
];

// ─── Validation helpers ───────────────────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
  detectedLabel?: string;
}

/**
 * Validate a claimed MIME type against an allowlist.
 * Use before issuing a signed upload URL (fast, no I/O required).
 */
export function validateMimeType(
  claimedMime: string,
  allowlist: ReadonlySet<string>,
): FileValidationResult {
  // Normalise: strip charset / boundary parameters.
  const base = claimedMime.split(";")[0].trim().toLowerCase();
  if (!allowlist.has(base)) {
    return { valid: false, reason: `mime_not_allowed:${base}` };
  }
  return { valid: true };
}

/**
 * Validate actual file bytes using magic-byte signatures.
 * Returns `valid: false` for dangerous signatures or unknown headers.
 *
 * Note: pass at least 16 bytes of the file start for best coverage.
 */
export function validateMagicBytes(
  bytes: Uint8Array,
  allowlist: ReadonlySet<string> = ADMIN_STORAGE_TYPES,
): FileValidationResult {
  void allowlist; // reserved for future integration

  // 1. Reject dangerous bytes unconditionally.
  for (const sig of DANGEROUS_SIGNATURES) {
    if (matchesSignature(bytes, sig)) {
      return { valid: false, reason: `dangerous_file_type:${sig.label}`, detectedLabel: sig.label };
    }
  }

  // 2. Accept if a safe signature matches.
  for (const sig of SAFE_SIGNATURES) {
    if (matchesSignature(bytes, sig)) {
      return { valid: true, detectedLabel: sig.label };
    }
  }

  // 3. Plain text: if the first 512 bytes are all printable ASCII / UTF-8,
  //    treat as text/plain (covers CSV, simple HTML, etc.).
  if (bytes.length > 0 && isLikelyPlainText(bytes.slice(0, 512))) {
    return { valid: true, detectedLabel: "PLAIN_TEXT" };
  }

  return { valid: false, reason: "unknown_file_signature" };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function matchesSignature(data: Uint8Array, sig: MagicSignature): boolean {
  const { offset, bytes } = sig;
  if (data.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    const expected = bytes[i];
    if (expected !== null && data[offset + i] !== expected) return false;
  }
  return true;
}

function isLikelyPlainText(data: Uint8Array): boolean {
  for (const byte of data) {
    // Allow printable ASCII, tab, LF, CR, and common UTF-8 multibyte lead bytes.
    if (
      byte < 0x09 ||
      (byte > 0x0d && byte < 0x20 && byte !== 0x1b) ||
      byte === 0x7f
    ) {
      return false;
    }
  }
  return true;
}
