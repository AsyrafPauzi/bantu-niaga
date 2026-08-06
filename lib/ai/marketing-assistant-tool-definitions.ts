import "server-only";

import {
  EXTRA_ACTION_TOOLS,
  MARKETING_ASSISTANT_EXTRA_TOOLS,
} from "@/lib/ai/marketing-assistant-extra-tools";

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
  {
    type: "function" as const,
    function: {
      name: "get_marketing_overview",
      description:
        "Read CRM KPIs: customer counts, VIP, dormant, at-risk, segments, coupons, content drafts.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_customers",
      description:
        "List customers, optionally filtered by auto tag (vip, dormant, at-risk, repeat, new) or search name.",
      parameters: {
        type: "object",
        properties: {
          auto_tag: {
            type: "string",
            enum: ["vip", "dormant", "at-risk", "repeat", "new"],
            description: "Filter by auto-tag.",
          },
          search: {
            type: "string",
            description: "Partial name search.",
          },
          limit: {
            type: "number",
            description: "Max rows (default 15, max 30).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_segments",
      description: "List customer segments with member counts for broadcast targeting.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max rows (default 20, max 40).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "refresh_auto_tags",
      description:
        "Recompute VIP, repeat, new, at-risk, and dormant auto-tags from latest purchase data when the user asks to refresh tags.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  ...MARKETING_ASSISTANT_EXTRA_TOOLS,
];

const ACTION_TOOLS = new Set([
  "create_broadcast_draft",
  "create_coupon",
  "create_content_draft",
  "update_customer_note_or_tag",
  ...EXTRA_ACTION_TOOLS,
]);

export function isMarketingActionTool(name: string): boolean {
  return ACTION_TOOLS.has(name);
}
