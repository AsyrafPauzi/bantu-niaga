import { z } from "zod";

/**
 * Zod schemas for /api/auth/* endpoints.
 *
 * Stricter password rules than the inner password-change form because new
 * users haven't proven anything yet — we want a solid baseline.
 */

const passwordRules = z
  .string()
  .min(12, "Min 12 characters")
  .max(72)
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[0-9]/, "Add a number");

export const signUpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Use a valid email"),
    password: passwordRules,
    business_name: z.string().trim().min(2, "Business name is too short").max(120),
    state_code: z
      .enum([
        "JHR",
        "KDH",
        "KTN",
        "MLK",
        "NSN",
        "PHG",
        "PNG",
        "PRK",
        "PLS",
        "SBH",
        "SWK",
        "SGR",
        "TRG",
        "KUL",
        "LBN",
        "PJY",
      ])
      .optional(),
    accept_terms: z.literal(true, {
      message: "Accept the terms to continue",
    }),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Use a valid email"),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    new_password: passwordRules,
  })
  .strict();
