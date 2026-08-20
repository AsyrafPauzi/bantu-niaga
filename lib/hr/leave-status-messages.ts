export type LeaveDecisionStatus = "approved" | "rejected";

export function buildLeaveDecisionMessages(input: {
  status: LeaveDecisionStatus;
  employeeName: string;
  leaveTypeLabel: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}): { en: string; ms: string } {
  const range =
    input.startDate === input.endDate
      ? input.startDate
      : `${input.startDate} – ${input.endDate}`;
  const reasonEn = input.reason?.trim()
    ? ` Note: ${input.reason.trim()}`
    : "";
  const reasonMs = input.reason?.trim()
    ? ` Nota: ${input.reason.trim()}`
    : "";

  if (input.status === "approved") {
    return {
      en: `Hi ${input.employeeName}, your ${input.leaveTypeLabel} (${range}) has been approved.${reasonEn}`,
      ms: `Hai ${input.employeeName}, cuti ${input.leaveTypeLabel} anda (${range}) telah diluluskan.${reasonMs}`,
    };
  }

  return {
    en: `Hi ${input.employeeName}, your ${input.leaveTypeLabel} (${range}) was not approved.${reasonEn}`,
    ms: `Hai ${input.employeeName}, cuti ${input.leaveTypeLabel} anda (${range}) tidak diluluskan.${reasonMs}`,
  };
}

export function waMeUrl(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
