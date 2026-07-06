import { publicLeaveCreateSchema, type PublicLeaveCreateInput } from "@/lib/hr/schemas";

export interface ParsedStaffLeaveRequest {
  fields: PublicLeaveCreateInput;
  mcFile: File | null;
}

export async function parseStaffLeaveRequest(
  request: Request,
): Promise<ParsedStaffLeaveRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const mcEntry = formData.get("mc_document");
    const mcFile =
      mcEntry instanceof File && mcEntry.size > 0 ? mcEntry : null;

    const fields = publicLeaveCreateSchema.parse({
      leave_type: String(formData.get("leave_type") ?? ""),
      start_date: String(formData.get("start_date") ?? ""),
      end_date: String(formData.get("end_date") ?? ""),
      reason: formData.get("reason"),
    });

    return { fields, mcFile };
  }

  const body = await request.json();
  const fields = publicLeaveCreateSchema.parse(body);
  return { fields, mcFile: null };
}
