import { z } from "zod";

import type { ConsentKind } from "./types";

const CONSENT_KINDS = [
  "terms_of_service",
  "privacy_notice",
  "marketing_email",
  "product_updates",
  "ai_training",
  "analytics",
] as const satisfies readonly ConsentKind[];

export const consentToggleSchema = z.object({
  kind: z.enum(CONSENT_KINDS),
  granted: z.boolean(),
});

export const consentsUpdateSchema = z.object({
  changes: z.array(consentToggleSchema).min(1).max(20),
});

export const requestExportSchema = z
  .object({
    reason: z.string().max(280).optional(),
  })
  .strict();

export const requestDeleteSchema = z
  .object({
    scope: z.enum(["user", "business"]),
    confirmation: z.literal("DELETE"),
    reason: z.string().max(280).optional(),
  })
  .strict();

export const cancelDeleteSchema = z
  .object({
    request_id: z.string().uuid(),
  })
  .strict();
