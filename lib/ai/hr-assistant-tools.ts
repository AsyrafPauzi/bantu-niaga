import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import {
  applyAnnualLeaveApproval,
  loadEmployeeLeaveBalance,
} from "@/lib/hr/leave-balance";
import { analyzeLeaveDateRange } from "@/lib/hr/leave-date-check";
import { leaveCreateSchema, leaveStatusUpdateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const HR_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_leave_balance",
      description:
        "Look up an employee's annual leave balance for the current year when the user asks how many days they have left.",
      parameters: {
        type: "object",
        properties: {
          employee_name: {
            type: "string",
            description: "Employee full or first name.",
          },
        },
        required: ["employee_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_leave_record",
      description:
        "Create a leave record when the user explicitly asks to record, book, or create leave (cuti/MC). Warns about weekends and public holidays in the range.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          leave_type: {
            type: "string",
            enum: ["annual", "emergency", "mc"],
          },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
          reason: { type: "string" },
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
        "Approve or reject a pending leave request. Use leave_id or start_date when the employee has more than one pending request.",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          decision: { type: "string", enum: ["approved", "rejected"] },
          leave_id: {
            type: "string",
            description: "Optional UUID from the data packet.",
          },
          start_date: {
            type: "string",
            description: "Optional YYYY-MM-DD to pick a specific pending request.",
          },
          decision_note: { type: "string" },
        },
        required: ["employee_name", "decision"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_onboarding_item",
      description:
        "Mark an open onboarding checklist item as done when the user confirms (e.g. completed orientation, submitted IC).",
      parameters: {
        type: "object",
        properties: {
          employee_name: { type: "string" },
          item_label: {
            type: "string",
            description: "Part of the checklist label to match.",
          },
        },
        required: ["employee_name", "item_label"],
        additionalProperties: false,
      },
    },
  },
];

const getBalanceArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
});

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
  leave_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  decision_note: z.string().trim().max(500).optional(),
});

const completeOnboardingArgsSchema = z.object({
  employee_name: z.string().trim().min(1).max(160),
  item_label: z.string().trim().min(1).max(200),
});

type HrToolSuccess = {
  ok: true;
  action: string;
  warnings?: string[];
  href?: string;
  [key: string]: unknown;
};

export type HrToolResult =
  | HrToolSuccess
  | { ok: false; action: string; message: string };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveEmployeeByName(
  businessId: string,
  nameQuery: string,
): Promise<
  | { kind: "one"; id: string; full_name: string; entitlement: number }
  | { kind: "none" }
  | { kind: "many"; names: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hr_employees")
    .select("id, full_name, annual_leave_entitlement_days")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) throw new Error("Could not load employees.");

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
      entitlement: Number(matches[0].annual_leave_entitlement_days ?? 8),
    };
  }
  return { kind: "many", names: matches.map((m) => m.full_name) };
}

export async function executeGetLeaveBalance(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof getBalanceArgsSchema>;
  try {
    args = getBalanceArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "get_leave_balance", message: "Invalid request." };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "get_leave_balance",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "get_leave_balance",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const balance = await loadEmployeeLeaveBalance(
    supabase,
    ctx.businessId,
    employee.id,
    employee.entitlement,
  );

  return {
    ok: true,
    action: "get_leave_balance",
    employee_name: employee.full_name,
    leave_year: balance.leaveYear,
    entitlement_days: balance.entitlementDays,
    taken_days: balance.takenDays,
    available_days: balance.availableDays,
    href: `/hr/employees/${employee.id}?tab=leave`,
  };
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
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "create_leave_record",
      message: `Several employees match: ${employee.names.join(", ")}.`,
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
  const dateAnalysis = await analyzeLeaveDateRange(
    supabase,
    ctx.businessId,
    args.start_date,
    args.end_date,
  );

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
      message: "Could not save the leave record.",
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
    working_days_in_range: dateAnalysis.workingDays,
    warnings: dateAnalysis.warnings.length > 0 ? dateAnalysis.warnings : undefined,
    href: `/hr/leave/history`,
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
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "update_leave_status",
      message: `Several employees match: ${employee.names.join(", ")}.`,
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

  let pendingQuery = supabase
    .from("hr_leave_records")
    .select("id, leave_type, start_date, end_date, status, employee_id")
    .eq("business_id", ctx.businessId)
    .eq("employee_id", employee.id)
    .eq("status", "pending");

  if (args.leave_id) {
    pendingQuery = pendingQuery.eq("id", args.leave_id);
  } else if (args.start_date) {
    pendingQuery = pendingQuery.eq("start_date", args.start_date);
  }

  const { data: pendingRows, error: findError } = await pendingQuery
    .order("created_at", { ascending: false })
    .limit(args.leave_id || args.start_date ? 1 : 5);

  if (findError) {
    return {
      ok: false,
      action: "update_leave_status",
      message: "Could not look up pending leave.",
    };
  }

  const pending = pendingRows?.[0];
  if (!pending) {
    return {
      ok: false,
      action: "update_leave_status",
      message: `No matching pending leave for ${employee.full_name}.`,
    };
  }
  if (!args.leave_id && !args.start_date && (pendingRows?.length ?? 0) > 1) {
    const options = (pendingRows ?? [])
      .map((r) => `${r.start_date}–${r.end_date} (${r.leave_type}, id ${r.id})`)
      .join("; ");
    return {
      ok: false,
      action: "update_leave_status",
      message: `Multiple pending requests — ask which dates or pass leave_id: ${options}`,
    };
  }

  const warnings: string[] = [];
  if (statusPayload.status === "approved" && pending.leave_type === "annual") {
    const analysis = await analyzeLeaveDateRange(
      supabase,
      ctx.businessId,
      String(pending.start_date),
      String(pending.end_date),
    );
    warnings.push(...analysis.warnings);
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

  if (
    statusPayload.status === "approved" &&
    pending.leave_type === "annual"
  ) {
    const result = await applyAnnualLeaveApproval(supabase, {
      businessId: ctx.businessId,
      employeeId: employee.id,
      startDate: String(pending.start_date),
      endDate: String(pending.end_date),
      entitlementDays: employee.entitlement,
    });
    if (result.warning) {
      warnings.push(result.warning.message);
    }
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
    warnings: warnings.length > 0 ? warnings : undefined,
    href: "/hr/leave/history",
  };
}

export async function executeCompleteOnboardingItem(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<HrToolResult> {
  let args: z.infer<typeof completeOnboardingArgsSchema>;
  try {
    args = completeOnboardingArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: "Invalid onboarding details.",
    };
  }

  const employee = await resolveEmployeeByName(ctx.businessId, args.employee_name);
  if (employee.kind === "none") {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `No active employee matching "${args.employee_name}".`,
    };
  }
  if (employee.kind === "many") {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `Several employees match: ${employee.names.join(", ")}.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const labelQuery = normalizeName(args.item_label);
  const { data: items, error: listError } = await supabase
    .from("hr_onboarding_items")
    .select("id, label, is_done")
    .eq("business_id", ctx.businessId)
    .eq("employee_id", employee.id)
    .eq("is_done", false);

  if (listError) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: "Could not load onboarding items.",
    };
  }

  const matches = (items ?? []).filter((row) =>
    normalizeName(String(row.label)).includes(labelQuery),
  );
  if (matches.length === 0) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `No open onboarding item matching "${args.item_label}" for ${employee.full_name}.`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: `Several items match: ${matches.map((m) => m.label).join(", ")}.`,
    };
  }

  const { data, error } = await supabase
    .from("hr_onboarding_items")
    .update({
      is_done: true,
      completed_by: ctx.userId,
      completed_at: new Date().toISOString(),
    })
    .eq("business_id", ctx.businessId)
    .eq("id", matches[0].id)
    .select("id, label, is_done")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "complete_onboarding_item",
      message: "Could not update the onboarding item.",
    };
  }

  return {
    ok: true,
    action: "complete_onboarding_item",
    employee_name: employee.full_name,
    item_label: data.label,
    item_id: data.id,
    href: `/hr/employees/${employee.id}?tab=onboarding`,
  };
}

const ALLOWED_TOOLS = new Set([
  "get_leave_balance",
  "create_leave_record",
  "update_leave_status",
  "complete_onboarding_item",
]);

export async function executeHrAssistantTool(
  ctx: AgentContext,
  name: string,
  rawArgs: unknown,
): Promise<HrToolResult> {
  if (!ALLOWED_TOOLS.has(name)) {
    return { ok: false, action: name, message: "That action is not allowed." };
  }
  if (name === "get_leave_balance") {
    return executeGetLeaveBalance(ctx, rawArgs);
  }
  if (name === "create_leave_record") {
    return executeCreateLeaveRecord(ctx, rawArgs);
  }
  if (name === "update_leave_status") {
    return executeUpdateLeaveStatus(ctx, rawArgs);
  }
  if (name === "complete_onboarding_item") {
    return executeCompleteOnboardingItem(ctx, rawArgs);
  }
  return { ok: false, action: name, message: "Unknown action." };
}

export function malaysiaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

export function isHrActionTool(name: string): boolean {
  return (
    name === "create_leave_record" ||
    name === "update_leave_status" ||
    name === "complete_onboarding_item"
  );
}
