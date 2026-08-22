import "server-only";

import { resolveAgentContext } from "@/lib/ai/context";
import { buildMayaCommerceContext } from "@/lib/ai/maya-commerce-context";
import {
  openaiChat,
  type ChatCompletionResponse,
} from "@/lib/ai/openai";
import { spendCredits, isInsufficientCreditsError } from "@/lib/ai/credits";
import { recordAiUsage } from "@/lib/ai/usage";
import { estimateCostMyr } from "@/lib/ai/model-costs";
import { chatCreditsForReasoning } from "@/lib/settings/reasoning-credits";
import { resolveAgentModel } from "@/lib/settings/ai-agents-catalog";
import { getAgentCreditsSpentToday } from "@/lib/settings/ai-agents";
import {
  getCreditBalance,
  hasMarketingAssistantAddon,
  loadBusinessAgentSettings,
} from "@/lib/marketplace/entitlements";
import { MARKETING_AGENT_SLUG } from "@/lib/marketplace/agent-types";
import { creditsToMyr } from "@/lib/settings/credit-pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { detectUserLanguage, type UserLanguage } from "@/lib/ai/user-language";
import {
  looksLikeStaffReport,
  sanitizeRewrittenCaption,
} from "@/lib/ai/maya-caption-sanitize";

export type RewriteChannel = "tiktok" | "instagram" | "facebook";

export type RewriteFailure =
  | {
      ok: false;
      status: number;
      error: string;
      message: string;
      marketplace_href?: string;
      billing_href?: string;
      credit_balance?: number;
    }
  | {
      ok: true;
      caption: string;
      credits: { charged: number; balance: number };
    };

/** Caption rewrite must NOT use staff-chat language instructions (Ringkasan, etc.). */
function captionLanguageHint(lang: UserLanguage): string {
  const lock =
    "HARD RULE: Write the entire caption in this language only. Do not translate into another language. Do not mix in English section titles or Malay report headings unless the draft already uses them.";

  switch (lang) {
    case "bahasa_malaysia":
      return `${lock} Language: Bahasa Malaysia (natural social-media BM).`;
    case "bahasa_kelantan":
      return `${lock} Language: Kelantan Malay.`;
    case "bahasa_terengganu":
      return `${lock} Language: Terengganu Malay.`;
    case "bahasa_kedah":
      return `${lock} Language: Kedah / Northern Malay.`;
    case "bahasa_sabah":
      return `${lock} Language: Sabah Malay.`;
    case "bahasa_sarawak":
      return `${lock} Language: Sarawak Malay.`;
    case "mandarin_simplified":
      return `${lock} Language: Simplified Chinese (简体中文).`;
    case "mandarin_traditional":
      return `${lock} Language: Traditional Chinese (繁體中文).`;
    case "cantonese":
      return `${lock} Language: Cantonese (Traditional characters).`;
    case "hokkien":
      return `${lock} Language: Malaysian Hokkien (same script style as the draft).`;
    case "tamil":
      return `${lock} Language: Tamil (தமிழ்).`;
    case "english":
    default:
      return `${lock} Language: English.`;
  }
}

function detectCaptionLanguage(hook: string | null | undefined, caption: string): UserLanguage {
  // Prefer the caption body — that's what we rewrite. Fall back to hook if caption is tiny.
  const primary = caption.trim();
  const secondary = (hook ?? "").trim();
  const sample =
    primary.length >= 12
      ? primary
      : `${primary} ${secondary}`.trim();

  let lang = detectUserLanguage(sample || secondary);

  // Social BM often uses particles the generic detector under-weights.
  const socialBm =
    /\b(dah|untuk|dengan|yang|ada|jom|sedap|promo|raya|hari|kami|kita|boleh|tak|nak|mau|mahu)\b/i.test(
      sample,
    );
  const socialEn =
    /\b(the|and|for|with|your|our|today|order|now|limited|fresh|taste|ready)\b/i.test(
      sample,
    );

  if (socialBm && !socialEn && lang === "english") {
    lang = "bahasa_malaysia";
  } else if (socialEn && !socialBm && lang === "bahasa_malaysia") {
    lang = "english";
  }

  return lang;
}

/**
 * Only product names that appear in the draft/hook — never dump the full
 * catalog or sales MTD into the model prompt.
 */
function slimProductHints(
  draft: string,
  products: Array<{ name: string; price_myr: number }>,
): string {
  const hay = draft.toLowerCase();
  const matched = products.filter((p) => {
    const name = p.name.trim();
    if (name.length < 3) return false;
    return hay.includes(name.toLowerCase());
  });

  if (matched.length === 0) {
    // Light touch: up to 3 catalog names the model may weave in ONLY if
    // they clearly fit the draft topic — still no prices/sales dump.
    return products
      .slice(0, 3)
      .map((p) => p.name)
      .join(", ");
  }

  return matched
    .slice(0, 5)
    .map((p) => `${p.name} (RM ${p.price_myr.toFixed(2)})`)
    .join(", ");
}

export async function rewriteCaptionWithMaya(opts: {
  channel: RewriteChannel;
  caption: string;
  hook?: string | null;
  hashtags?: string[];
}): Promise<RewriteFailure> {
  const ctx = await resolveAgentContext();
  const supabase = await createSupabaseServerClient();

  const [addonActive, settings, spentToday, businessRes, creditBalance] =
    await Promise.all([
      hasMarketingAssistantAddon(ctx.businessId),
      loadBusinessAgentSettings(ctx.businessId, MARKETING_AGENT_SLUG),
      getAgentCreditsSpentToday(ctx.businessId, MARKETING_AGENT_SLUG),
      supabase
        .from("businesses")
        .select("name")
        .eq("id", ctx.businessId)
        .single(),
      getCreditBalance(ctx.businessId),
    ]);

  if (!addonActive) {
    return {
      ok: false,
      status: 403,
      error: "addon_required",
      message:
        "Subscribe to Marketing AI (Maya) in the Marketplace to rewrite captions.",
      marketplace_href: "/marketplace",
    };
  }

  if (!settings.assistantEnabled) {
    return {
      ok: false,
      status: 403,
      error: "assistant_disabled",
      message: "Maya is turned off in Settings → AI Agents.",
    };
  }

  if (spentToday >= settings.dailyBudgetCredits) {
    return {
      ok: false,
      status: 429,
      error: "daily_budget_exceeded",
      message: `Daily budget reached (${settings.dailyBudgetCredits} credits · RM ${creditsToMyr(settings.dailyBudgetCredits).toFixed(2)}).`,
    };
  }

  const chatCost = chatCreditsForReasoning(settings.reasoningMode);
  if (creditBalance < chatCost) {
    return {
      ok: false,
      status: 402,
      error: "insufficient_credits",
      message:
        "No credits left in your shared pool. Top up in Billing or wait for your monthly refill.",
      billing_href: "/settings/billing",
      credit_balance: creditBalance,
    };
  }

  let productHint = "";
  try {
    const commerce = await buildMayaCommerceContext(ctx);
    productHint = slimProductHints(
      `${opts.hook ?? ""} ${opts.caption}`,
      commerce.topProducts,
    );
  } catch {
    productHint = "";
  }

  const businessName = businessRes.data?.name ?? "this business";
  const displayName = settings.displayName || "Maya";
  const lang = detectCaptionLanguage(opts.hook, opts.caption);
  const channelLabel =
    opts.channel === "tiktok"
      ? "TikTok"
      : opts.channel === "instagram"
        ? "Instagram"
        : "Facebook";

  const model = resolveAgentModel({
    reasoningMode: settings.reasoningMode,
    modelOverride: settings.modelOverride,
  });

  const system = `You are ${displayName}, a social-copy writer for ${businessName} (Malaysian micro-SME).
Task: rewrite ONE ${channelLabel} caption from the draft.

LANGUAGE (highest priority — never violate):
- ${captionLanguageHint(lang)}
- Mirror the draft: English draft → English caption; Malay draft → Malay caption; Chinese/Tamil/dialect → same.
- If the draft mixes languages casually (e.g. BM + English brand names), keep that same mix — do not "correct" it into a full translation.

OUTPUT RULES (strict):
- Return ONLY the caption text ready to paste into ${channelLabel}.
- No markdown headings, no **bold section titles**, no bullet menus, no numbered lists of products.
- Do NOT include: Ringkasan, Menu Hari Ini, Jualan, Langkah Seterusnya, sales MTD, % change, full price lists, or staff-report format.
- 2–5 short paragraphs / line breaks max. Keep it punchy for social.
- Improve hook, sensory detail, and a light CTA. Stay faithful to the draft topic.
- Never invent products, prices, or sales figures. If you mention a product, only use names from PRODUCT HINTS (optional).
- Do not add hashtags unless they were already in the draft.

PRODUCT HINTS (optional flavour — do not dump as a menu):
${productHint || "(none — rewrite from the draft only)"}`;

  const userParts = [
    `Channel: ${channelLabel}`,
    `Detected draft language: ${lang} — keep the rewrite in this language.`,
    opts.hook?.trim() ? `Hook: ${opts.hook.trim()}` : null,
    `Draft:\n${opts.caption.trim()}`,
    opts.hashtags && opts.hashtags.length > 0
      ? `Hashtags already chosen (do not repeat in body): ${opts.hashtags.join(" ")}`
      : null,
    "Reply with the caption only, in the same language as the draft.",
  ]
    .filter(Boolean)
    .join("\n\n");

  let completion: ChatCompletionResponse;
  try {
    completion = await openaiChat<ChatCompletionResponse>({
      model,
      // Critical: do not inject the marketing staff briefing (causes Ringkasan reports).
      includeBriefing: false,
      context: ctx,
      temperature: 0.55,
      max_tokens: 450,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts },
      ],
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: "provider_unavailable",
      message:
        "Maya needs ILMU or OpenAI configured on the platform (Super Admin → Integrations, or ILMU_API_KEY on Vercel).",
    };
  }

  // Use raw model text — skip formatAssistantReply staff post-processing.
  const raw = (completion.choices?.[0]?.message?.content ?? "").trim();
  const caption = sanitizeRewrittenCaption(raw);
  if (!caption || looksLikeStaffReport(caption)) {
    return {
      ok: false,
      status: 502,
      error: "bad_rewrite",
      message:
        "Maya returned a report instead of a caption. Try again with a clearer draft.",
    };
  }

  let spend;
  try {
    spend = await spendCredits(ctx, {
      amount: chatCost,
      reason: "maya.content.rewrite",
    });
  } catch (e) {
    if (isInsufficientCreditsError(e)) {
      return {
        ok: false,
        status: 402,
        error: "insufficient_credits",
        message:
          "No credits left in your shared pool. Top up in Billing or wait for your monthly refill.",
        billing_href: "/settings/billing",
        credit_balance: creditBalance,
      };
    }
    throw e;
  }

  await recordAiUsage({
    businessId: ctx.businessId,
    actorUserId: ctx.userId,
    triggerType: "CHAT",
    creditsCharged: spend.charged,
    mode: "fast",
    costMyrEstimated: estimateCostMyr(model, 0, 0),
    agentSlug: MARKETING_AGENT_SLUG,
    metadata: {
      action: "content_caption_rewrite",
      channel: opts.channel,
      reasoning_mode: settings.reasoningMode,
    },
  });

  return {
    ok: true,
    caption: caption.slice(0, 2200),
    credits: { charged: spend.charged, balance: spend.balance },
  };
}
