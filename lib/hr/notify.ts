import "server-only";

import { postBusinessNotification } from "@/lib/notifications/post";
import { leaveTypeShort } from "@/lib/hr/leave-labels";

function postHr(
  businessId: string,
  eventType: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  void postBusinessNotification({
    businessId,
    pillar: "hr",
    eventType,
    message,
    meta,
  });
}

export function notifyHrEmployeeCreated(input: {
  businessId: string;
  employeeId: string;
  fullName: string;
  roleTitle: string | null;
}): void {
  const role = input.roleTitle ? ` (${input.roleTitle})` : "";
  postHr(
    input.businessId,
    "hr.employee.created",
    `Employee added: ${input.fullName}${role}`,
    { employee_id: input.employeeId },
  );
}

export function notifyHrLeaveRequested(input: {
  businessId: string;
  leaveId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}): void {
  const range =
    input.startDate === input.endDate
      ? input.startDate
      : `${input.startDate} – ${input.endDate}`;
  postHr(
    input.businessId,
    "hr.leave.requested",
    `Leave request: ${input.employeeName} · ${leaveTypeShort(input.leaveType)} · ${range}`,
    { leave_id: input.leaveId },
  );
}

export function notifyHrLeaveStatusChanged(input: {
  businessId: string;
  leaveId: string;
  employeeName: string;
  leaveType: string;
  status: string;
}): void {
  postHr(
    input.businessId,
    "hr.leave.status_changed",
    `Leave ${input.status}: ${input.employeeName} · ${leaveTypeShort(input.leaveType)}`,
    { leave_id: input.leaveId, status: input.status },
  );
}

export function notifyHrDocumentUploaded(input: {
  businessId: string;
  documentId: string;
  employeeName: string;
  label: string;
}): void {
  postHr(
    input.businessId,
    "hr.document.uploaded",
    `Document uploaded for ${input.employeeName}: ${input.label}`,
    { document_id: input.documentId },
  );
}
