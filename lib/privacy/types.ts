/**
 * Types for the PDPA / Data-Subject-Request subsystem.
 *
 * Everything is camelCase on the wire; database columns are snake_case and
 * adapted in lib/privacy/load.ts.
 */

export type DsrKind =
  | "export"
  | "delete_user"
  | "delete_business"
  | "rectify"
  | "consent_change"
  | "object";

export type DsrStatus =
  | "pending"
  | "in_progress"
  | "awaiting_grace"
  | "completed"
  | "cancelled"
  | "failed";

export interface DataSubjectRequest {
  id: string;
  businessId: string;
  userId: string;
  kind: DsrKind;
  status: DsrStatus;
  reason: string | null;
  payload: Record<string, unknown>;
  scheduledFor: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConsentKind =
  | "terms_of_service"
  | "privacy_notice"
  | "marketing_email"
  | "product_updates"
  | "ai_training"
  | "analytics"
  | "third_party_share";

export interface UserConsent {
  id: string;
  businessId: string;
  userId: string;
  kind: ConsentKind;
  granted: boolean;
  policyVersion: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string;
}

export interface DataExportSummary {
  id: string;
  requestId: string;
  byteSize: number;
  expiresAt: string;
  createdAt: string;
}
