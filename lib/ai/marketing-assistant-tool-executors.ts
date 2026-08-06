import "server-only";

import { z } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import {
  EXTRA_ACTION_TOOLS,
  EXTRA_READ_TOOLS,
  executeMarketingExtraTool,
} from "@/lib/ai/marketing-assistant-extra-tools";
import { MARKETING_ASSISTANT_TOOLS } from "@/lib/ai/marketing-assistant-tool-definitions";
import { generateCouponCode } from "@/lib/marketing/coupon-code";
import { getKpiSnapshot } from "@/lib/marketing/dashboard-queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

function sanitizeLike(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
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
  const safe = sanitizeLike(nameQuery);
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, notes, manual_tags")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .ilike("name", `%${safe}%`)
    .order("name", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error("Could not load customers.");
  }

  const matches = data ?? [];
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
  "get_marketing_overview",
  "list_customers",
  "list_segments",
  "refresh_auto_tags",
  ...EXTRA_READ_TOOLS,
  ...EXTRA_ACTION_TOOLS,
]);

export async function executeGetMarketingOverview(
  ctx: AgentContext,
): Promise<Record<string, unknown>> {
  const supabase = await createSupabaseServerClient();
  const snapshot = await getKpiSnapshot(supabase, ctx.businessId);

  const [segmentsRes, couponsRes, broadcastsRes, contentRes] = await Promise.all([
    supabase
      .from("customer_segments")
      .select("id, name, member_count, kind")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(10),
    supabase
      .from("coupons")
      .select("id, code, status, redeemed_count")
      .eq("business_id", ctx.businessId)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("broadcasts")
      .select("id, name, status, channel")
      .eq("business_id", ctx.businessId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("content_plan")
      .select("id, channel, status, hook")
      .eq("business_id", ctx.businessId)
      .in("status", ["drafted", "scheduled"])
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  return {
    ok: true,
    action: "get_marketing_overview",
    customers: {
      total: snapshot.totalCustomers,
      new_mtd: snapshot.newThisMonth,
      vip: snapshot.vipCount,
      dormant: snapshot.dormantCount,
      at_risk: snapshot.atRiskCount,
      repeat: snapshot.repeatCount,
      total_spend_myr: snapshot.totalSpendMyr,
    },
    segments: segmentsRes.data ?? [],
    active_coupons: couponsRes.data ?? [],
    recent_broadcasts: broadcastsRes.data ?? [],
    content_drafts: contentRes.data ?? [],
  };
}

export async function executeListCustomers(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<Record<string, unknown>> {
  const parsed = z
    .object({
      auto_tag: z
        .enum(["vip", "dormant", "at-risk", "repeat", "new"])
        .optional(),
      search: z.string().trim().min(1).max(80).optional(),
      limit: z.number().int().min(1).max(30).optional().default(15),
    })
    .parse(rawArgs ?? {});

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, auto_tags, manual_tags, total_spend_myr, order_count, last_purchase_at",
    )
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .order("total_spend_myr", { ascending: false })
    .limit(parsed.limit);

  if (parsed.auto_tag) {
    query = query.contains("auto_tags", [parsed.auto_tag]);
  }
  if (parsed.search) {
    const safe = sanitizeLike(parsed.search);
    query = query.ilike("name", `%${safe}%`);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, action: "list_customers", message: "Could not load customers." };
  }

  return {
    ok: true,
    action: "list_customers",
    customers: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      phone_e164: row.phone_e164,
      email: row.email,
      auto_tags: row.auto_tags,
      manual_tags: row.manual_tags,
      total_spend_myr: row.total_spend_myr,
      order_count: row.order_count,
      last_purchase_at: row.last_purchase_at,
      href: `/marketing/customers/${row.id}`,
    })),
  };
}

export async function executeListSegments(
  ctx: AgentContext,
  rawArgs: unknown,
): Promise<Record<string, unknown>> {
  const parsed = z
    .object({
      limit: z.number().int().min(1).max(40).optional().default(20),
    })
    .parse(rawArgs ?? {});

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_segments")
    .select("id, name, kind, auto_key, member_count")
    .eq("business_id", ctx.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(parsed.limit);

  if (error) {
    return { ok: false, action: "list_segments", message: "Could not load segments." };
  }

  return {
    ok: true,
    action: "list_segments",
    segments: (data ?? []).map((row) => ({
      ...row,
      href: `/marketing/segments/${row.id}`,
    })),
  };
}

export async function executeRefreshAutoTags(
  ctx: AgentContext,
): Promise<Record<string, unknown>> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("marketing_apply_auto_tags", {
    p_business_id: ctx.businessId,
  });

  if (error) {
    return {
      ok: false,
      action: "refresh_auto_tags",
      message: "Could not refresh auto-tags.",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const updated =
    row && typeof row === "object" && "updated_count" in row
      ? Number((row as { updated_count: unknown }).updated_count)
      : null;

  return {
    ok: true,
    action: "refresh_auto_tags",
    updated_count: Number.isFinite(updated) ? updated : null,
    href: "/marketing/customers",
  };
}

export async function executeMarketingAssistantTool(
  ctx: AgentContext,
  name: string,
  rawArgs: unknown,
): Promise<MarketingToolResult | Record<string, unknown>> {
  if (!ALLOWED_TOOLS.has(name)) {
    return { ok: false, action: name, message: "That action is not allowed." };
  }
  if (name === "get_marketing_overview") {
    return executeGetMarketingOverview(ctx);
  }
  if (name === "list_customers") {
    try {
      return await executeListCustomers(ctx, rawArgs);
    } catch {
      return { ok: false, action: "list_customers", message: "Invalid list filters." };
    }
  }
  if (name === "list_segments") {
    try {
      return await executeListSegments(ctx, rawArgs);
    } catch {
      return { ok: false, action: "list_segments", message: "Invalid segment list request." };
    }
  }
  if (name === "refresh_auto_tags") {
    return executeRefreshAutoTags(ctx);
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
  if (EXTRA_READ_TOOLS.has(name) || EXTRA_ACTION_TOOLS.has(name)) {
    try {
      return await executeMarketingExtraTool(ctx, name, rawArgs);
    } catch {
      return { ok: false, action: name, message: "Invalid request." };
    }
  }
  return { ok: false, action: name, message: "Unknown action." };
}
