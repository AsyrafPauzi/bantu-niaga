export const WARNING_LETTER_SEVERITIES = [
  "verbal",
  "standard",
  "final",
] as const;

export type WarningLetterSeverity = (typeof WARNING_LETTER_SEVERITIES)[number];

export interface HrWarningLetterRow {
  id: string;
  employee_id: string;
  issued_at: string;
  reason: string;
  severity: WarningLetterSeverity;
  admin_file_id: string | null;
  issued_by: string | null;
  created_at: string;
}
