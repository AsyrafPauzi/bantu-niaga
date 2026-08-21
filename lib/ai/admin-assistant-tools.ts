import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { malaysiaTodayYmd } from "@/lib/sales/schemas";

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling schema)
// ---------------------------------------------------------------------------

export const ADMIN_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_tasks",
      description:
        "List open (or done) admin tasks for this business. Call when the user asks about tasks, to-dos, or backlog.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["open", "done", "all"],
            description: "Filter by task status. Defaults to open.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Number of tasks to return (1–20). Defaults to 10.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description:
        "Create a new admin task when the user explicitly asks to add, create, or log a task.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short task title (max 200 characters).",
          },
          due_date: {
            type: "string",
            description: "Optional due date in YYYY-MM-DD format.",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high"],
            description: "Task priority.",
          },
          notes: {
            type: "string",
            description: "Optional notes or description.",
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task_status",
      description:
        "Mark an admin task as open or done when the user explicitly confirms completion or re-opens a task. Use task_id or task_title to identify the task.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "Optional UUID of the task.",
          },
          task_title: {
            type: "string",
            description: "Part of the task title to search for.",
          },
          status: {
            type: "string",
            enum: ["open", "done"],
            description: "New status for the task.",
          },
          notes: {
            type: "string",
            description: "Optional notes to append.",
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_compliance_items",
      description:
        "List compliance/licence items. Optionally filter by status (active, expired, expiring_soon). Call when the user asks about licences, renewals, or compliance.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "expired", "expiring_soon"],
            description:
              "Optional filter. expiring_soon = expires within 60 days and still active.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Number of items to return (1–20). Defaults to 10.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_compliance_status",
      description:
        "Update the status of a compliance/licence item (e.g. mark renewed, expired, or pending renewal). Optionally set a new expiry date.",
      parameters: {
        type: "object",
        properties: {
          item_id: {
            type: "string",
            description: "Optional UUID of the compliance item.",
          },
          item_name: {
            type: "string",
            description: "Part of the item name/title to search for.",
          },
          status: {
            type: "string",
            enum: ["active", "expired", "pending_renewal"],
            description: "New status for the compliance item.",
          },
          renewal_date: {
            type: "string",
            description:
              "Optional new expiry date in YYYY-MM-DD format (sets expires_on).",
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_document_summary",
      description:
        "Get a summary of stored documents grouped by category. Call when the user asks about file storage or uploaded documents.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_credit_balance",
      description:
        "Get the current NiagaX credit balance for this business. Call when the user asks about credits, balance, or billing.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const listTasksArgsSchema = z.object({
  status: z.enum(["open", "done", "all"]).optional().default("open"),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

const createTaskArgsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const updateTaskStatusArgsSchema = z.object({
  task_id: z.string().uuid().optional(),
  task_title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["open", "done"]),
  notes: z.string().trim().max(2000).optional(),
});

const listComplianceArgsSchema = z.object({
  status: z.enum(["active", "expired", "expiring_soon"]).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

const updateComplianceStatusArgsSchema = z.object({
  item_id: z.string().uuid().optional(),
  item_name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["active", "expired", "pending_renewal"]),
  renewal_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type AdminToolSuccess = {
  ok: true;
  action: string;
  href?: string;
  [key: string]: unknown;
};

type AdminToolResult =
  | AdminToolSuccess
  | { ok: false; action: string; message: string; href?: string };

// ---------------------------------------------------------------------------
// Execute functions
// ---------------------------------------------------------------------------

async function executeListTasks(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<AdminToolResult> {
  let args: z.infer<typeof listTasksArgsSchema>;
  try {
    args = listTasksArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "list_tasks", message: "Invalid request." };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("admin_tasks")
    .select("id, title, status, due_date, priority, notes")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null);

  if (args.status === "open") {
    query = query.eq("status", "open");
  } else if (args.status === "done") {
    query = query.eq("status", "done");
  }

  const { data, error } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(args.limit);

  if (error) {
    return { ok: false, action: "list_tasks", message: "Could not load tasks." };
  }

  return {
    ok: true,
    action: "list_tasks",
    tasks: (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      priority: t.priority,
      notes: t.notes,
    })),
    count: (data ?? []).length,
    href: "/admin/tasks",
  };
}

async function executeCreateTask(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<AdminToolResult> {
  let args: z.infer<typeof createTaskArgsSchema>;
  try {
    args = createTaskArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "create_task", message: "Invalid request." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_tasks")
    .insert({
      business_id: ctx.businessId,
      title: args.title,
      due_date: args.due_date ?? null,
      priority: args.priority ?? "normal",
      notes: args.notes ?? null,
      status: "open",
      created_by: ctx.userId,
    })
    .select("id, title, status, due_date, priority")
    .single();

  if (error || !data) {
    return { ok: false, action: "create_task", message: "Could not create the task." };
  }

  return {
    ok: true,
    action: "create_task",
    task_id: data.id,
    title: data.title,
    status: data.status,
    due_date: data.due_date,
    priority: data.priority,
    href: "/admin/tasks",
  };
}

async function executeUpdateTaskStatus(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<AdminToolResult> {
  let args: z.infer<typeof updateTaskStatusArgsSchema>;
  try {
    args = updateTaskStatusArgsSchema.parse(rawArgs);
  } catch {
    return { ok: false, action: "update_task_status", message: "Invalid request." };
  }

  if (!args.task_id && !args.task_title) {
    return {
      ok: false,
      action: "update_task_status",
      message: "Provide either task_id or task_title to identify the task.",
    };
  }

  const supabase = await createSupabaseServerClient();

  let taskId: string;
  let taskTitle: string;

  if (args.task_id) {
    const { data, error } = await supabase
      .from("admin_tasks")
      .select("id, title")
      .eq("business_id", ctx.businessId)
      .eq("id", args.task_id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return {
        ok: false,
        action: "update_task_status",
        message: "Task not found.",
      };
    }
    taskId = data.id as string;
    taskTitle = data.title as string;
  } else {
    const { data, error } = await supabase
      .from("admin_tasks")
      .select("id, title")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .ilike("title", `%${args.task_title}%`);

    if (error) {
      return {
        ok: false,
        action: "update_task_status",
        message: "Could not search tasks.",
      };
    }

    const matches = data ?? [];
    if (matches.length === 0) {
      return {
        ok: false,
        action: "update_task_status",
        message: `No task matching "${args.task_title}" found.`,
      };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        action: "update_task_status",
        message: `Multiple tasks match "${args.task_title}": ${matches.map((m) => `"${m.title as string}"`).join(", ")}. Use task_id or a more specific title.`,
      };
    }

    taskId = matches[0].id as string;
    taskTitle = matches[0].title as string;
  }

  const patch: Record<string, unknown> = {
    status: args.status,
    updated_by: ctx.userId,
  };
  if (args.notes !== undefined) patch.notes = args.notes;
  if (args.status === "done") {
    patch.completed_at = new Date().toISOString();
    patch.completed_by = ctx.userId;
  } else {
    patch.completed_at = null;
    patch.completed_by = null;
  }

  const { error: updateError } = await supabase
    .from("admin_tasks")
    .update(patch)
    .eq("business_id", ctx.businessId)
    .eq("id", taskId);

  if (updateError) {
    return {
      ok: false,
      action: "update_task_status",
      message: "Could not update the task.",
    };
  }

  return {
    ok: true,
    action: "update_task_status",
    task_id: taskId,
    title: taskTitle,
    new_status: args.status,
    href: "/admin/tasks",
  };
}

async function executeListComplianceItems(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<AdminToolResult> {
  let args: z.infer<typeof listComplianceArgsSchema>;
  try {
    args = listComplianceArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "list_compliance_items",
      message: "Invalid request.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const todayYmd = malaysiaTodayYmd();
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = supabase
    .from("admin_compliance_items")
    .select("id, title, category, status, expires_on, admin_file_id")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null);

  if (args.status === "expiring_soon") {
    query = query
      .eq("status", "active")
      .lte("expires_on", in60Days)
      .gte("expires_on", todayYmd);
  } else if (args.status === "expired") {
    query = query.lt("expires_on", todayYmd);
  } else if (args.status === "active") {
    query = query.eq("status", "active");
  }

  const { data, error } = await query
    .order("expires_on", { ascending: true })
    .limit(args.limit);

  if (error) {
    return {
      ok: false,
      action: "list_compliance_items",
      message: "Could not load compliance items.",
    };
  }

  return {
    ok: true,
    action: "list_compliance_items",
    items: (data ?? []).map((item) => ({
      id: item.id,
      name: item.title,
      category: item.category,
      status: item.status,
      expiry_date: item.expires_on,
      has_certificate: item.admin_file_id != null,
    })),
    count: (data ?? []).length,
    href: "/admin/compliance",
  };
}

async function executeUpdateComplianceStatus(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<AdminToolResult> {
  let args: z.infer<typeof updateComplianceStatusArgsSchema>;
  try {
    args = updateComplianceStatusArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "update_compliance_status",
      message: "Invalid request.",
    };
  }

  if (!args.item_id && !args.item_name) {
    return {
      ok: false,
      action: "update_compliance_status",
      message: "Provide either item_id or item_name to identify the compliance item.",
    };
  }

  const supabase = await createSupabaseServerClient();

  let itemId: string;
  let itemName: string;
  let currentExpiry: string | null;

  if (args.item_id) {
    const { data, error } = await supabase
      .from("admin_compliance_items")
      .select("id, title, expires_on")
      .eq("business_id", ctx.businessId)
      .eq("id", args.item_id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return {
        ok: false,
        action: "update_compliance_status",
        message: "Compliance item not found.",
      };
    }
    itemId = data.id as string;
    itemName = data.title as string;
    currentExpiry = data.expires_on as string | null;
  } else {
    const { data, error } = await supabase
      .from("admin_compliance_items")
      .select("id, title, expires_on")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .ilike("title", `%${args.item_name}%`);

    if (error) {
      return {
        ok: false,
        action: "update_compliance_status",
        message: "Could not search compliance items.",
      };
    }

    const matches = data ?? [];
    if (matches.length === 0) {
      return {
        ok: false,
        action: "update_compliance_status",
        message: `No compliance item matching "${args.item_name}" found.`,
      };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        action: "update_compliance_status",
        message: `Multiple items match "${args.item_name}": ${matches.map((m) => `"${m.title as string}"`).join(", ")}. Use item_id or a more specific name.`,
      };
    }

    itemId = matches[0].id as string;
    itemName = matches[0].title as string;
    currentExpiry = matches[0].expires_on as string | null;
  }

  const patch: Record<string, unknown> = { status: args.status };
  if (args.renewal_date) {
    patch.expires_on = args.renewal_date;
  }

  const { error: updateError } = await supabase
    .from("admin_compliance_items")
    .update(patch)
    .eq("business_id", ctx.businessId)
    .eq("id", itemId);

  if (updateError) {
    return {
      ok: false,
      action: "update_compliance_status",
      message: "Could not update compliance item.",
    };
  }

  return {
    ok: true,
    action: "update_compliance_status",
    item_id: itemId,
    name: itemName,
    new_status: args.status,
    new_expiry_date: args.renewal_date ?? currentExpiry,
    href: "/admin/compliance",
  };
}

async function executeGetDocumentSummary(
  ctx: AgentContext,
): Promise<AdminToolResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("admin_files")
    .select("id, category")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      action: "get_document_summary",
      message: "Could not load document summary.",
    };
  }

  const rows = data ?? [];
  const categoryMap: Record<string, number> = {};
  for (const row of rows) {
    const cat = (row.category as string | null) ?? "uncategorised";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }

  const breakdown = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ok: true,
    action: "get_document_summary",
    total_files: rows.length,
    breakdown,
    href: "/admin/storage",
  };
}

async function executeGetCreditBalance(
  ctx: AgentContext,
): Promise<AdminToolResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("businesses")
    .select("credit_balance")
    .eq("id", ctx.businessId)
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "get_credit_balance",
      message: "Could not retrieve credit balance.",
    };
  }

  return {
    ok: true,
    action: "get_credit_balance",
    credit_balance: data.credit_balance ?? 0,
    href: "/settings/billing",
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const ALLOWED_ADMIN_TOOLS = new Set([
  "list_tasks",
  "create_task",
  "update_task_status",
  "list_compliance_items",
  "update_compliance_status",
  "get_document_summary",
  "get_credit_balance",
]);

export async function executeAdminAssistantTool(
  ctx: AgentContext,
  name: string,
  rawArgs: unknown,
): Promise<AdminToolResult> {
  if (!ALLOWED_ADMIN_TOOLS.has(name)) {
    return { ok: false, action: name, message: "That action is not allowed." };
  }
  if (name === "list_tasks") return executeListTasks(ctx, rawArgs);
  if (name === "create_task") return executeCreateTask(ctx, rawArgs);
  if (name === "update_task_status") return executeUpdateTaskStatus(ctx, rawArgs);
  if (name === "list_compliance_items") return executeListComplianceItems(ctx, rawArgs);
  if (name === "update_compliance_status") return executeUpdateComplianceStatus(ctx, rawArgs);
  if (name === "get_document_summary") return executeGetDocumentSummary(ctx);
  if (name === "get_credit_balance") return executeGetCreditBalance(ctx);
  return { ok: false, action: name, message: "Unknown action." };
}

export function isAdminActionTool(name: string): boolean {
  return (
    name === "create_task" ||
    name === "update_task_status" ||
    name === "update_compliance_status"
  );
}
