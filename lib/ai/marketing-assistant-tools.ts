import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import { generateCouponCode } from "@/lib/marketing/coupon-code";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const MARKETING_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_broadcast_draft",
      description:
        "Create a draft broadcast (WhatsApp CTC or email) for a named segment when the user explicitly asks to draft or create a broadcast / promo message.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Short broadcast name for the list (max 120 chars).",
          },
          channel: {
            type: "string",
            enum: ["whatsapp_ctc", "email"],
            description: "whatsapp_ctc = WhatsApp click-to-chat; email = email.",
          },
          segment_name: {
            type: "string",
            description: "Segment name as the user said it (partial match OK).",
          },
          message_template: {
            type: "string",
            description:
              "Message body. May include {first_name} and {coupon_code} placeholders.",
          },
          subject: {
            type: "string",
            description: "Email subject (required for email channel).",
          },
        },
        required: ["name", "channel", "segment_name", "message_template"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_coupon",
      description:
        "Create an active coupon / promo code when the user explicitly asks to create a discount.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Optional friendly name for the coupon.",
          },
          type: {
            type: "string",
            enum: ["PCT", "AMT"],
            description: "PCT = percent off; AMT = fixed RM amount off.",
          },
          value: {
            type: "number",
            description: "Percent (e.g. 10) or RM amount (e.g. 5).",
          },
          code: {
            type: "string",
            description: "Optional code; auto-generated if omitted.",
          },
        },
        required: ["type", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_content_draft",
      description:
        "Save a content calendar draft (TikTok / Instagram / Facebook) when the user asks to save a caption or post idea.",
      parameters: {
        type: "object",
        properties: {
          channel: {
            type: "string",
            enum: ["tiktok", "instagram", "facebook"],
          },
          hook: {
            type: "string",
            description: "Short hook / headline (max 280 chars).",
          },
          caption: {
            type: "string",
            description: "Full caption text.",
          },
          hashtags: {
            type: "array",
            items: { type: "string" },
            description: "Hashtags with or without #.",
          },
        },
        required: ["channel", "caption"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_customer_note_or_tag",
      description:
        "Add a note and/or manual tag on a named customer when the user explicitly asks.",
      parameters: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "Customer name as the user said it.",
          },
          note: {
            type: "string",
            description: "Note to append (optional if tag is set).",
          },
          tag: {
            type: "string",
            description: "Manual tag to add (optional if note is set).",
          },
        },
        required: ["customer_name"],
        additionalProperties: false,
      },
    },
  },
];

const createBroadcastArgsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: z.enum(["whatsapp_ctc", "email"]),
  segment_name: z.string().trim().min(1).max(160),
  message_template: z.string().trim().min(1).max(4000),
  subject: z.string().trim().max(200).optional(),
});

const createCouponArgsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["PCT", "AMT"]),
  value: z.number().finite().positive().max(100_000),
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

const createContentArgsSchema = z.object({
  channel: z.enum(["tiktok", "instagram", "facebook"]),
  hook: z.string().trim().max(280).optional(),
  caption: z.string().trim().min(1).max(4000),
  hashtags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
});

const updateCustomerArgsSchema = z
  .object({
    customer_name: z.string().trim().min(1).max(160),
    note: z.string().trim().min(1).max(2000).optional(),
    tag: z.string().trim().min(1).max(40).optional(),
  })
  .refine((v) => Boolean(v.note || v.tag), {
    message: "Provide a note and/or tag.",
  });

export type MarketingToolResult =
  | {
      ok: true;
      action: "create_broadcast_draft";
      broadcast_id: string;
      name: string;
      channel: string;
      segment_name: string;
      href: string;
    }
  | {
      ok: true;
      action: "create_coupon";
      coupon_id: string;
      code: string;
      type: string;
      value: number;
      href: string;
    }
  | {
      ok: true;
      action: "create_content_draft";
      content_id: string;
      channel: string;
      href: string;
    }
  | {
      ok: true;
      action: "update_customer_note_or_tag";
      customer_id: string;
      customer_name: string;
      note_added: boolean;
      tag_added: string | null;
      href: string;
    }
  | { ok: false; action: string; message: string };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveSegmentByName(
  businessId: string,
  nameQuery: string,
): Promise<
  | { kind: "one"; id: string; name: string }
  | { kind: "none" }
  | { kind: "many"; names: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_segments")
    .select("id, name")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Could not load segments.");
  }

  const query = normalizeName(nameQuery);
  const matches = (data ?? []).filter((row) =>
    normalizeName(row.name).includes(query),
  );

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    return { kind: "one", id: matches[0].id, name: matches[0].name };
  }
  return { kind: "many", names: matches.map((m) => m.name) };
}

async function resolveCustomerByName(
  businessId: string,
  nameQuery: string,
): Promise<
  | { kind: "one"; id: string; name: string; notes: string | null; manual_tags: string[] }
  | { kind: "none" }
  | { kind: "many"; names: string[] }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, notes, manual_tags")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error("Could not load customers.");
  }

  const query = normalizeName(nameQuery);
  const matches = (data ?? []).filter((row) =>
    normalizeName(row.name).includes(query),
  );

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) {
    const row = matches[0];
    return {
      kind: "one",
      id: row.id,
      name: row.name,
      notes: row.notes ?? null,
      manual_tags: Array.isArray(row.manual_tags) ? row.manual_tags : [],
    };
  }
  return { kind: "many", names: matches.map((m) => m.name) };
}

export async function executeCreateBroadcastDraft(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<MarketingToolResult> {
  let args: z.infer<typeof createBroadcastArgsSchema>;
  try {
    args = createBroadcastArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "create_broadcast_draft",
      message: "Invalid broadcast details.",
    };
  }

  if (args.channel === "email" && !args.subject?.trim()) {
    return {
      ok: false,
      action: "create_broadcast_draft",
      message: "Email broadcasts need a subject line.",
    };
  }

  const segment = await resolveSegmentByName(ctx.businessId, args.segment_name);
  if (segment.kind === "none") {
    return {
      ok: false,
      action: "create_broadcast_draft",
      message: `No segment matching "${args.segment_name}". Create one under Segments first, or use a VIP / dormant filter.`,
    };
  }
  if (segment.kind === "many") {
    return {
      ok: false,
      action: "create_broadcast_draft",
      message: `Several segments match "${args.segment_name}": ${segment.names.join(", ")}. Ask which one.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      business_id: ctx.businessId,
      name: args.name,
      channel: args.channel,
      segment_id: segment.id,
      subject: args.channel === "email" ? (args.subject ?? null) : null,
      message_template: args.message_template,
      created_by: ctx.userId,
    })
    .select("id, name, channel")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "create_broadcast_draft",
      message: "Could not save the broadcast draft. Try again from Broadcasts.",
    };
  }

  return {
    ok: true,
    action: "create_broadcast_draft",
    broadcast_id: data.id,
    name: data.name,
    channel: data.channel,
    segment_name: segment.name,
    href: `/marketing/broadcasts/${data.id}`,
  };
}

export async function executeCreateCoupon(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<MarketingToolResult> {
  let args: z.infer<typeof createCouponArgsSchema>;
  try {
    args = createCouponArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "create_coupon",
      message: "Invalid coupon details. Use PCT or AMT with a positive value.",
    };
  }

  if (args.type === "PCT" && args.value > 100) {
    return {
      ok: false,
      action: "create_coupon",
      message: "Percent discounts cannot exceed 100%.",
    };
  }

  const codeProvided = Boolean(args.code);
  let code = args.code ?? generateCouponCode(8);
  const supabase = await createSupabaseServerClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        business_id: ctx.businessId,
        code,
        name: args.name ?? null,
        type: args.type,
        value: args.value,
        min_subtotal_myr: 0,
        valid_from: new Date().toISOString(),
        per_customer_limit: 1,
        status: "active",
        created_by: ctx.userId,
      })
      .select("id, code, type, value")
      .single();

    if (!error && data) {
      return {
        ok: true,
        action: "create_coupon",
        coupon_id: data.id,
        code: data.code,
        type: data.type,
        value: Number(data.value),
        href: `/marketing/coupons/${data.id}`,
      };
    }

    if (error?.code === "23505") {
      if (codeProvided) {
        return {
          ok: false,
          action: "create_coupon",
          message: "That coupon code is already in use. Pick another code.",
        };
      }
      code = generateCouponCode(8);
      continue;
    }

    return {
      ok: false,
      action: "create_coupon",
      message: "Could not create the coupon. Try again from Coupons.",
    };
  }

  return {
    ok: false,
    action: "create_coupon",
    message: "Could not generate a unique coupon code. Try again.",
  };
}

export async function executeCreateContentDraft(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<MarketingToolResult> {
  let args: z.infer<typeof createContentArgsSchema>;
  try {
    args = createContentArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "create_content_draft",
      message: "Invalid content details.",
    };
  }

  const hashtags = (args.hashtags ?? []).map((t) =>
    t.startsWith("#") ? t : `#${t}`,
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_plan")
    .insert({
      business_id: ctx.businessId,
      channel: args.channel,
      status: "drafted",
      hook: args.hook ?? null,
      caption: args.caption,
      hashtags,
      created_by: ctx.userId,
    })
    .select("id, channel")
    .single();

  if (error || !data) {
    return {
      ok: false,
      action: "create_content_draft",
      message: "Could not save the content draft. Try again from Content.",
    };
  }

  return {
    ok: true,
    action: "create_content_draft",
    content_id: data.id,
    channel: data.channel,
    href: `/marketing/content/${data.id}`,
  };
}

export async function executeUpdateCustomerNoteOrTag(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<MarketingToolResult> {
  let args: z.infer<typeof updateCustomerArgsSchema>;
  try {
    args = updateCustomerArgsSchema.parse(rawArgs);
  } catch {
    return {
      ok: false,
      action: "update_customer_note_or_tag",
      message: "Provide a customer name plus a note and/or tag.",
    };
  }

  const customer = await resolveCustomerByName(
    ctx.businessId,
    args.customer_name,
  );
  if (customer.kind === "none") {
    return {
      ok: false,
      action: "update_customer_note_or_tag",
      message: `No customer matching "${args.customer_name}" was found.`,
    };
  }
  if (customer.kind === "many") {
    return {
      ok: false,
      action: "update_customer_note_or_tag",
      message: `Several customers match "${args.customer_name}": ${customer.names.join(", ")}. Ask which full name.`,
    };
  }

  const setNotes = Boolean(args.note);
  const setManualTags = Boolean(args.tag);
  const nextNotes = setNotes
    ? [customer.notes?.trim(), args.note!.trim()].filter(Boolean).join("\n")
    : null;
  const nextTags = setManualTags
    ? Array.from(
        new Set([
          ...customer.manual_tags,
          args.tag!.trim().toLowerCase(),
        ]),
      ).slice(0, 20)
    : null;

  const changed: string[] = [];
  if (setNotes) changed.push("notes");
  if (setManualTags) changed.push("manual_tags");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("marketing_update_customer", {
    p_business_id: ctx.businessId,
    p_customer_id: customer.id,
    p_name: null,
    p_phone_e164: null,
    p_email: null,
    p_address: null,
    p_manual_tags: nextTags,
    p_notes: nextNotes,
    p_changed_fields: changed,
    p_actor_user_id: ctx.userId,
    p_set_phone: false,
    p_set_email: false,
    p_set_address: false,
    p_set_notes: setNotes,
    p_set_name: false,
    p_set_manual_tags: setManualTags,
  });

  if (error) {
    return {
      ok: false,
      action: "update_customer_note_or_tag",
      message: "Could not update the customer. Try again from their profile.",
    };
  }

  return {
    ok: true,
    action: "update_customer_note_or_tag",
    customer_id: customer.id,
    customer_name: customer.name,
    note_added: setNotes,
    tag_added: setManualTags ? args.tag!.trim().toLowerCase() : null,
    href: `/marketing/customers/${customer.id}`,
  };
}

const ALLOWED_TOOLS = new Set([
  "create_broadcast_draft",
  "create_coupon",
  "create_content_draft",
  "update_customer_note_or_tag",
]);

export async function executeMarketingAssistantTool(
  ctx: AgentContext,
  name: string,
  rawArgs: unknown,
): Promise<MarketingToolResult> {
  if (!ALLOWED_TOOLS.has(name)) {
    return { ok: false, action: name, message: "That action is not allowed." };
  }
  if (name === "create_broadcast_draft") {
    return executeCreateBroadcastDraft(ctx, rawArgs);
  }
  if (name === "create_coupon") {
    return executeCreateCoupon(ctx, rawArgs);
  }
  if (name === "create_content_draft") {
    return executeCreateContentDraft(ctx, rawArgs);
  }
  if (name === "update_customer_note_or_tag") {
    return executeUpdateCustomerNoteOrTag(ctx, rawArgs);
  }
  return { ok: false, action: name, message: "Unknown action." };
}

export function malaysiaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

export function isMarketingActionTool(name: string): boolean {
  return ALLOWED_TOOLS.has(name);
}
