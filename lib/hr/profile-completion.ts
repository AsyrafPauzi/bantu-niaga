import type { HrDocumentRow, HrEmployeeRow } from "@/lib/hr/load";

/** Document types every active employee must upload (linked file in HR documents). */
export const COMPULSORY_DOCUMENT_TYPES = ["ic", "bank", "contract"] as const;

export type CompulsoryDocumentType = (typeof COMPULSORY_DOCUMENT_TYPES)[number];

export const COMPULSORY_DOCUMENT_LABELS: Record<CompulsoryDocumentType, string> = {
  ic: "IC",
  bank: "Bank details",
  contract: "Employment contract",
};

export function documentTypeLabel(type: string): string {
  return (
    COMPULSORY_DOCUMENT_LABELS[type as CompulsoryDocumentType] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function getEmployeeUploadedDocumentTypes(
  documents: HrDocumentRow[],
  employeeId: string,
): Set<string> {
  return new Set(
    documents
      .filter((doc) => doc.employee_id === employeeId && doc.admin_file_id)
      .map((doc) => doc.document_type),
  );
}

export function getMissingCompulsoryDocuments(
  uploadedTypes: Set<string>,
): CompulsoryDocumentType[] {
  return COMPULSORY_DOCUMENT_TYPES.filter((type) => !uploadedTypes.has(type));
}

export interface ProfileCompletionGap {
  missingContactFields: string[];
  missingDocuments: CompulsoryDocumentType[];
}

export function getProfileCompletionGaps(
  employee: HrEmployeeRow,
  documents: HrDocumentRow[],
): ProfileCompletionGap {
  const missingContactFields: string[] = [];
  if (!employee.phone_e164) missingContactFields.push("phone");
  if (!employee.emergency_contact_name) missingContactFields.push("emergency contact");
  if (!employee.bank_name) missingContactFields.push("bank name");
  if (!employee.bank_account_no && !employee.bank_account_no_sealed) {
    missingContactFields.push("bank account");
  }

  const missingDocuments = getMissingCompulsoryDocuments(
    getEmployeeUploadedDocumentTypes(documents, employee.id),
  );

  return { missingContactFields, missingDocuments };
}

export function isEmployeeProfileIncomplete(
  employee: HrEmployeeRow,
  documents: HrDocumentRow[],
): boolean {
  if (employee.status !== "active") return false;
  const gaps = getProfileCompletionGaps(employee, documents);
  return (
    gaps.missingContactFields.length > 0 || gaps.missingDocuments.length > 0
  );
}

export function describeProfileGaps(gaps: ProfileCompletionGap): string {
  const parts: string[] = [];
  if (gaps.missingContactFields.length > 0) {
    parts.push(`missing ${gaps.missingContactFields.join(", ")}`);
  }
  if (gaps.missingDocuments.length > 0) {
    parts.push(
      `missing ${gaps.missingDocuments.map((t) => COMPULSORY_DOCUMENT_LABELS[t]).join(", ")}`,
    );
  }
  return parts.join(" · ");
}

export type SetupChecklistItemId =
  | "phone"
  | "bank"
  | "ic_file"
  | "contract_file";

export interface SetupChecklistItem {
  id: SetupChecklistItemId;
  label: string;
  done: boolean;
  /** DOM id to scroll to when user taps Add now */
  scrollTarget: string;
  tab?: "profile" | "documents";
}

/** Four-item setup checklist shown on employee profile (core HR). */
export function getEmployeeSetupChecklist(
  employee: HrEmployeeRow,
  documents: HrDocumentRow[],
): SetupChecklistItem[] {
  const uploaded = getEmployeeUploadedDocumentTypes(documents, employee.id);
  const hasPhone = Boolean(employee.phone_e164?.trim());
  const hasBank =
    Boolean(employee.bank_name?.trim()) &&
    Boolean(employee.bank_account_no || employee.bank_account_no_sealed);

  return [
    {
      id: "phone",
      label: "Phone number",
      done: hasPhone,
      scrollTarget: "hr-field-phone",
      tab: "profile",
    },
    {
      id: "bank",
      label: "Bank name and account",
      done: hasBank,
      scrollTarget: "hr-field-bank-name",
      tab: "profile",
    },
    {
      id: "ic_file",
      label: "IC file uploaded",
      done: uploaded.has("ic") || uploaded.has("passport"),
      scrollTarget: "hr-section-documents",
      tab: "documents",
    },
    {
      id: "contract_file",
      label: "Employment contract uploaded",
      done: uploaded.has("contract"),
      scrollTarget: "hr-section-documents",
      tab: "documents",
    },
  ];
}

export function isSetupChecklistComplete(items: SetupChecklistItem[]): boolean {
  return items.every((item) => item.done);
}
