import { leaveCreateSchema, type LeaveCreateInput } from "@/lib/hr/schemas";

export interface ParsedManagerLeaveRequest {
  fields: LeaveCreateInput;
  mcFile: File | null;
}

export async function parseManagerLeaveRequest(
  request: Request,
): Promise<ParsedManagerLeaveRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const mcEntry = formData.get("mc_document");
    const mcFile =
      mcEntry instanceof File && mcEntry.size > 0 ? mcEntry : null;

    const fields = leaveCreateSchema.parse({
      employee_id: String(formData.get("employee_id") ?? ""),
      leave_type: String(formData.get("leave_type") ?? ""),
      start_date: String(formData.get("start_date") ?? ""),
      end_date: String(formData.get("end_date") ?? ""),
      reason: formData.get("reason"),
    });

    return { fields, mcFile };
  }

  const body = await request.json();
  const fields = leaveCreateSchema.parse(body);
  return { fields, mcFile: null };
}
