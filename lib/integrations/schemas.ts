import { z } from "zod";

/**
 * Zod schemas for the platform-admin integrations API.
 *
 * The `secrets` map allows three semantics per key:
 *   - omitted    → leave existing value untouched
 *   - ""         → leave existing value untouched (UX convenience)
 *   - string     → encrypt + persist as new value
 *   - null       → clear the stored secret
 */

export const integrationUpsertSchema = z
  .object({
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    secrets: z.record(z.string(), z.string().nullable()).optional(),
  })
  .strict();
