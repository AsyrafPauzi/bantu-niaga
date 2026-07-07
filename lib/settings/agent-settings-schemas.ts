import { z } from "zod";
import {
  clampDailyBudgetCredits,
  DAILY_BUDGET_MAX_CREDITS,
  DAILY_BUDGET_MIN_CREDITS,
} from "@/lib/settings/credit-pricing";

export const hrAgentSettingsSchema = z
  .object({
    display_name: z.string().trim().min(1).max(40),
    assistant_enabled: z.boolean(),
    daily_notice_enabled: z.boolean(),
  })
  .strict();

export type HrAgentSettingsInput = z.infer<typeof hrAgentSettingsSchema>;

export const agentSettingsUpdateSchema = z
  .object({
    display_name: z.string().trim().min(1).max(40).optional(),
    assistant_enabled: z.boolean().optional(),
    daily_notice_enabled: z.boolean().optional(),
    reasoning_mode: z.enum(["fast", "deep"]).optional(),
    daily_budget_credits: z
      .number()
      .int()
      .min(DAILY_BUDGET_MIN_CREDITS)
      .max(DAILY_BUDGET_MAX_CREDITS)
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export type AgentSettingsUpdateInput = z.infer<typeof agentSettingsUpdateSchema>;
