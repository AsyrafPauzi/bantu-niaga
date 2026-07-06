import { z } from "zod";

export const hrAgentSettingsSchema = z
  .object({
    display_name: z.string().trim().min(1).max(40),
    assistant_enabled: z.boolean(),
    daily_notice_enabled: z.boolean(),
  })
  .strict();

export type HrAgentSettingsInput = z.infer<typeof hrAgentSettingsSchema>;
