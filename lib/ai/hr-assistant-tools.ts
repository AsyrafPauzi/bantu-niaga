import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import { leaveCreateSchema, leaveStatusUpdateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const HR_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_leave_record",
      description:
        "Create a leave record for an employee when the user explicitly asks to record, book, or create leave (cuti/MC). Only use employees that exist in the HR data packet.",
      parameters: {
        type: "object",
        properties: {
          employee_name: {
            type: "string",
            description:
              "Employee name as the user said it (first name or full name).",
          },
          leave_type: {
            type: "string",
            enum: ["annual", "emergency", "mc"],
            description:
              "annual = annual leave / cuti tahunan; mc = medical leave / MC / sakit; emergency = emergency leave.",
          },
          start_date: {
            type: "string",
            description: "Start date in YYYY-MM-DD (Malaysia calendar).",
          },
          end_date: {
            type: "string",
            description:
              "End date in YYYY-MM-DD. Use the same as start_date for a single day.",
          },
          reason: {
            type: "string",
            description: "Optional short reason (max 500 chars).",
          },
        },
        required: ["employee_name", "leave_type", "start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_leave_status",
      description:
        "Approve or reject the most recent pending leave request for an employee when the user explicitly asks to approve/lulus or reject/tolak their leave.",
      parameters: {
        type: "object",
        properties: {
          employee_name: {
            type: "string",
            description: "Employee full or first name.",
          },
          decision: {
            type: "string",
            enum: ["approved", "rejected"],
          },
          decision_note: {
            type: "string",
            description: "Optional note (max 500 chars).",
          },
        },
        required: ["employee_name", "decision"],
        additionalProperties: false,
      },
    },
  },
];

const createLeaveArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  leave_type: z.enum(["annual", "emergency", "mc"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional(),
});

const updateLeaveStatusArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  decision: z.enum(["approved", "rejected"]),
  decision_note: z.string().trim().max(500).optional(),
});

export type HrToolResult =
  | {
      ok: true;
      action: "create_leave_record";
      employee_name: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      status: string;
      leave_id: string;
    }
  | {
      ok: true;
      action: "update_leave_status";
      employee_name: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      status: string;
      leave_id: string;
    }
  | { ok: false; action: string; message: string };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveEmployeeByName(
  businessId: string,
  nameQuery: string,
): Promise<
  | { kind: "one"; id: string; full_name: string }
  | { kind: "none" }
  | { kind: "many"; names: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select("id, full_name")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error("Could not load employees.");
  }

  const query = normalizeName(nameQuery);
  const matches = (data ?? []).filter((row) =>
    normalizeName(row.full_name).includes(query),
  );

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    return {
      kind: "one",
      id: matches[0].id,
      full_name: matches[0].full_name,
    };
  }
  return { kind: "many", names: matches.map((m) => m.full_name) };
}

export async function executeCreateLeaveRecord(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof createLeaveArgsSchema>;
  try {
    args = createLeaveArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "create_leave_record",
      message: "Invalid leave details. Use YYYY-MM-DD dates and a valid leave type.",
    };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "create_leave_record",
      message: `No active employee matching "${args.employee_name}" was found in your HR records.`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "create_leave_record",
      message:
        `Several employees match "${args.employee_name}": ${employee.names.join(", ")}. ` +
        "Ask the user which full name to use.",
    };
  }

  let payload: z.infer<typeof leaveCreateSchema>;
  try {
    payload = leaveCreateSchema.parse({
      employee_id: employee.id,
      leave_type: args.leave_type,
      start_date: args.start_date,
      end_date: args.end_date,
      reason: args.reason ?? null,
    });
  } catch {
    return {
      ok: false,
      action: "create_leave_record",
      message: "End date cannot be before start date.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_leave_records")
    .insert({
      ...payload,
      business_id: ctx.businessId,
      requested_by: ctx.userId,
    })
    .select("id, leave_type, start_date, end_date, status")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "create_leave_record",
      message: "Could not save the leave record. Try again from the Leave page.",
    };
  }

  return {
    ok: true,
    action: "create_leave_record",
    employee_name: employee.full_name,
    leave_type: data.leave_type,
    start_date: data.start_date,
    end_date: data.end_date,
    status: data.status,
    leave_id: data.id,
  };
}

export async function executeUpdateLeaveStatus(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof updateLeaveStatusArgsSchema>;
  try {
    args = updateLeaveStatusArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Invalid approval details.",
    };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "update_leave_status",
      message: `No active employee matching "${args.employee_name}" was found.`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "update_leave_status",
      message:
        `Several employees match "${args.employee_name}": ${employee.names.join(", ")}. ` +
        "Ask which full name to use.",
    };
  }

  let statusPayload: z.infer<typeof leaveStatusUpdateSchema>;
  try {
    statusPayload = leaveStatusUpdateSchema.parse({
      status: args.decision,
      decision_note: args.decision_note ?? null,
    });
  } catch {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Could not validate the decision.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: pending, error: findError } = await supabase
    .from("hr_leave_records")
    .select("id, leave_type, start_date, end_date, status")
    .eq("business_id", ctx.businessId)
    .eq("employee_id", employee.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Could not look up pending leave.",
    };
  }
  if (!pending) {
    return {
      ok: false,
      action: "update_leave_status",
      message: `No pending leave found for ${employee.full_name}.`,
    };
  }

  const { data, error } = await supabase
    .from("hr_leave_records")
    .update({
      status: statusPayload.status,
      decision_note: statusPayload.decision_note ?? null,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("business_id", ctx.businessId)
    .eq("id", pending.id)
    .select("id, leave_type, start_date, end_date, status")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Could not update leave status.",
    };
  }

  return {
    ok: true,
    action: "update_leave_status",
    employee_name: employee.full_name,
    leave_type: data.leave_type,
    start_date: data.start_date,
    end_date: data.end_date,
    status: data.status,
    leave_id: data.id,
  };
}

const ALLOWED_TOOLS = new Set(["create_leave_record", "update_leave_status"]);

export async function executeHrAssistantTool(
  ctx: AgentContext,
  name: string,
  rawArgs: unknown,
): Promise<HrToolResult> {
  if (!ALLOWED_TOOLS.has(name)) {
    return { ok: false, action: name, message: "That action is not allowed." };
  }
  if (name === "create_leave_record") {
    return executeCreateLeaveRecord(ctx, rawArgs);
  }
  if (name === "update_leave_status") {
    return executeUpdateLeaveStatus(ctx, rawArgs);
  }
  return { ok: false, action: name, message: "Unknown action." };
}

export function malaysiaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

export function isHrActionTool(name: string): boolean {
  return name === "create_leave_record" || name === "update_leave_status";
}
