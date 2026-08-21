import "server-only";

import { z, type ZodSchema } from "zod";
import { logger } from "@/lib/logger";

/**
 * Output validation for AI responses.
 *
 * AI models can return malformed JSON, unexpected fields, or violate
 * business rules. This module validates the raw text/JSON from the model
 * before the application uses it.
 */

// ---------------------------------------------------------------------------
// Base text validation
// ---------------------------------------------------------------------------

/** Minimum and maximum character counts for assistant reply text. */
const REPLY_TEXT_SCHEMA = z
  .string()
  .min(1, "AI response was empty.")
  .max(20_000, "AI response exceeded maximum length.");

/**
 * Validates a plain-text assistant reply.
 * Returns the sanitised string or throws with a safe generic message.
 */
export function validateReplyText(raw: string | null | undefined): string {
  const result = REPLY_TEXT_SCHEMA.safeParse(raw ?? "");
  if (!result.success) {
    logger.warn("ai.output_validation.text_failed", {
      reason: result.error.issues[0]?.message,
    });
    throw new Error("The AI returned an invalid response. Please try again.");
  }
  return result.data.trim();
}

// ---------------------------------------------------------------------------
// JSON output validation
// ---------------------------------------------------------------------------

/**
 * Parses and validates JSON embedded in an AI response against a Zod schema.
 *
 * AI models sometimes wrap JSON in markdown code fences — this strips them
 * before parsing.
 *
 * @param raw      Raw string from the model
 * @param schema   Zod schema the parsed value must satisfy
 * @param context  Short label used in warning logs (never sent to the client)
 * @returns        Parsed and validated value, or null if parsing fails
 */
export function parseAIJson<T>(
  raw: string,
  schema: ZodSchema<T>,
  context = "unknown",
): T | null {
  // Strip markdown code fences if present
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    logger.warn("ai.output_validation.json_parse_failed", { context });
    return null;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    logger.warn("ai.output_validation.schema_failed", {
      context,
      issues: result.error.issues.map((i) => i.message).join("; "),
    });
    return null;
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Common schemas (reusable across pillar assistants)
// ---------------------------------------------------------------------------

/** A single tool-call argument object (any shape). */
export const toolArgsSchema = z.record(z.unknown());

/** Schema for a structured AI action response used by boardroom agents. */
export const boardroomActionSchema = z.object({
  action: z.string().min(1),
  rationale: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export type BoardroomAction = z.infer<typeof boardroomActionSchema>;
