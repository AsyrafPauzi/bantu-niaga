import { z } from "zod";
import { onboardingQuizSchema } from "@/lib/onboarding/schemas";

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

export const malaysianStateCodeSchema = z.enum([
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
]);

export const signUpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Use a valid email"),
    password: passwordRules,
    business_name: z.string().trim().min(2, "Business name is too short").max(120),
    state_code: malaysianStateCodeSchema.optional(),
    accept_terms: z.literal(true, {
      message: "Accept the terms to continue",
    }),
    signup_path: z.enum(["free", "starter_trial"]).optional().default("free"),
    onboarding_quiz: onboardingQuizSchema.optional(),
  })
  .strict();

export const completeGoogleSignupSchema = z
  .object({
    business_name: z
      .string()
      .trim()
      .min(2, "Business name is too short")
      .max(120),
    state_code: malaysianStateCodeSchema.optional(),
    accept_terms: z.literal(true, {
      message: "Accept the terms to continue",
    }),
    signup_path: z.enum(["free", "starter_trial"]).optional().default("free"),
    onboarding_quiz: onboardingQuizSchema.optional(),
  })
  .strict();

export type CompleteGoogleSignupInput = z.infer<
  typeof completeGoogleSignupSchema
>;

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

export const addBusinessSchema = z
  .object({
    password: z.string().min(1, "Enter your password to continue"),
    business_name: z.string().trim().min(2, "Business name is too short").max(120),
    state_code: malaysianStateCodeSchema.optional(),
    accept_terms: z.literal(true, {
      message: "Accept the terms to continue",
    }),
  })
  .strict();

export const switchBusinessSchema = z
  .object({
    business_id: z.string().uuid("Invalid business"),
  })
  .strict();
