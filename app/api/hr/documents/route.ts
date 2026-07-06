import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrDocuments } from "@/lib/hr/load";
import { employeeDocumentCreateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireHrUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "hr access denied" },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: error.code },
          { status: 401 },
        ),
      };
    }
    throw error;
  }
}

export async function GET() {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const documents = await loadHrDocuments(user.businessId);
  return NextResponse.json({ data: documents }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = employeeDocumentCreateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const { data: employee } = await supabase
    .from("hr_employees")
    .select("id")
    .eq("id", parsed.employee_id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json(
      { error: "employee_not_found", message: "Employee was not found." },
      { status: 404 },
    );
  }

  if (parsed.admin_file_id) {
    const { data: file } = await supabase
      .from("admin_files")
      .select("id")
      .eq("id", parsed.admin_file_id)
      .eq("business_id", user.businessId)
      .eq("category", "hr_doc")
      .is("deleted_at", null)
      .maybeSingle();

    if (!file) {
      return NextResponse.json(
        { error: "file_not_found", message: "HR document file was not found." },
        { status: 404 },
      );
    }
  }

  const { data, error } = await supabase
    .from("hr_employee_documents")
    .insert({
      ...parsed,
      business_id: user.businessId,
      created_by: user.id,
    })
    .select("id, employee_id, document_type, label, admin_file_id, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not add employee document." },
      { status: 500 },
    );
  }

  return NextResponse.json({ document: data }, { status: 201 });
}
