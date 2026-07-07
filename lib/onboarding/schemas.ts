import { z } from "zod";

export const onboardingQuizSchema = z
  .object({
    business_type: z.enum([
      "retail",
      "fnb",
      "services",
      "online",
      "freelancer",
      "other",
    ]),
    team_size_band: z.enum(["solo", "2-5", "6-15", "16+"]),
    priorities: z
      .array(
        z.enum(["invoices", "pos", "stock", "leave", "marketing"]),
      )
      .max(2),
  })
  .strict();

export type OnboardingQuizInput = z.infer<typeof onboardingQuizSchema>;
