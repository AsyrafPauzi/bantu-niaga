/**
 * Bantu Niaga — Security utilities barrel.
 *
 * Import from here for a stable public surface:
 *
 *   import { csrfCheck } from "@/lib/security";
 *   import { securityLog } from "@/lib/security";
 *   import { assertSafeUrl } from "@/lib/security";
 *   import { validateMimeType, validateMagicBytes } from "@/lib/security";
 */

export { csrfCheck } from "./csrf";
export { securityLog, type SecurityEventType, type SecurityEventMeta } from "./audit-log";
export { assertSafeUrl, checkSafeUrl, SsrfBlockedError } from "./ssrf-guard";
export {
  validateMimeType,
  validateMagicBytes,
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  ADMIN_STORAGE_TYPES,
  type FileValidationResult,
} from "./file-validation";
