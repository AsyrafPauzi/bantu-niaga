import { z } from "zod";

/**
 * Zod schemas for /api/settings/* routes.
 *
 * Settings are owner-only writes. The API handlers double-check the role
 * after Zod validation (defence-in-depth — the RLS policies on businesses
 * + payment_methods only allow owners, but the API can short-circuit
 * with a 403 before touching the DB).
 */

// ─────────────────────────────────────────────────────────────────────────
// Branding — PATCH /api/settings/business
// ─────────────────────────────────────────────────────────────────────────

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const hex = z
  .string()
  .trim()
  .regex(HEX_COLOR_REGEX, "Must be a 6-digit hex like #5B8C5A");

export const businessUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    brand_primary_hex: hex.optional(),
    brand_accent_hex: hex.optional(),
    registration_no: z.string().trim().max(80).nullable().optional(),
    sst_number: z.string().trim().max(80).nullable().optional(),
    contact_line: z.string().trim().max(200).nullable().optional(),
    receipt_footer: z.string().trim().max(500).nullable().optional(),
    email_from_name: z.string().trim().max(80).nullable().optional(),
    email_reply_to: z.string().trim().email().max(120).nullable().optional(),
  })
  .strict();

export type BusinessUpdateInput = z.infer<typeof businessUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Subscription — POST /api/settings/subscription/change
// ─────────────────────────────────────────────────────────────────────────

export const TIERS = ["starter", "micro", "sme", "enterprise"] as const;

export const tierChangeSchema = z
  .object({
    tier: z.enum(TIERS),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────
// Billing — payment methods
// ─────────────────────────────────────────────────────────────────────────

export const paymentMethodCreateSchema = z
  .object({
    kind: z.enum(["card", "fpx", "wallet"]),
    label: z.string().trim().min(1).max(80),
    masked: z.string().trim().min(1).max(40),
    owner_name: z.string().trim().max(120).nullable().optional(),
    exp_month: z.coerce.number().int().min(1).max(12).nullable().optional(),
    exp_year: z.coerce.number().int().min(2024).max(2099).nullable().optional(),
    provider: z
      .enum(["billplz", "curlec", "stripe", "manual"])
      .default("billplz"),
    make_default: z.boolean().optional().default(false),
  })
  .strict();

export const paymentMethodUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    is_default: z.boolean().optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────
// Billing — top-up Fast Credits
// ─────────────────────────────────────────────────────────────────────────

/**
 * Demo bundles. RM 10 / 50 credits, RM 20 / 110, RM 50 / 300.
 * The /topup route picks credits from the bundle keyed by `bundle`.
 */
export const TOPUP_BUNDLES = {
  small: { amount_myr: 10, credits: 50 },
  medium: { amount_myr: 20, credits: 110 },
  large: { amount_myr: 50, credits: 300 },
} as const;

export const topupSchema = z
  .object({
    bundle: z.enum(["small", "medium", "large"]),
    payment_method_id: z.string().uuid().optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────
// Security — password change
// ─────────────────────────────────────────────────────────────────────────

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z
      .string()
      .min(12, "Min 12 characters")
      .max(72)
      .regex(/[A-Z]/, "Add an uppercase letter")
      .regex(/[a-z]/, "Add a lowercase letter")
      .regex(/[0-9]/, "Add a number"),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────
// Security — 2FA enrol / verify
// ─────────────────────────────────────────────────────────────────────────

export const twoFaVerifySchema = z
  .object({
    factor_id: z.string().min(1),
    challenge_id: z.string().min(1),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator"),
  })
  .strict();

export const twoFaDisableSchema = z
  .object({
    factor_id: z.string().min(1),
  })
  .strict();
