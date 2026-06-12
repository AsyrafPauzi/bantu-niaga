/**
 * Bantu Niaga — pure-function classifier for CSV import preview.
 *
 * Per-row decision tree (decisions doc Q9):
 *
 *   1. If `name` is empty → reject ("missing name").
 *   2. If `phone` is empty → reject ("missing phone").
 *   3. If phone fails normalization → reject ("invalid phone").
 *   4. If the email is non-empty and malformed → reject ("invalid email").
 *   5. If the normalized phone appears earlier in the same upload →
 *      reject ("duplicate within upload"). The first occurrence is kept.
 *   6. If an existing live customer in this business has the same phone:
 *        a. Names normalize-equal → MERGE (informational; no insert).
 *        b. Names diverge → REJECT (Q9: deterministic; no in-app prompt
 *           from a bulk operation).
 *   7. Otherwise → CREATE.
 *
 * The function is **pure**: callers pass in the parsed row, the
 * normalized phone, and the existing-customer lookup result. No DB
 * calls live here. That keeps unit-testing trivial and the real I/O
 * (the lookup) batched at the API layer.
 *
 * @see docs/plans/marketing-implementation-plan.md §8.3
 * @see docs/plans/marketing-decisions.md Q9
 */

import type { ParsedRow } from "./csv";
import { normalizeName } from "./dedup";

export type PreviewAction = "create" | "merge" | "reject";

/**
 * Result of looking up the row's normalized phone in `customers`.
 *
 *  - `null`            → no live customer with this phone in the business.
 *  - existing customer → live customer found; supply its id + name so the
 *                        classifier can compare names.
 */
export type DedupCheck =
  | null
  | {
      id: string;
      name: string;
    };

export interface CreateOutcome {
  action: "create";
  row_number: number;
  name: string;
  phone_e164: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  manual_tags: string[];
}

export interface MergeOutcome {
  action: "merge";
  row_number: number;
  name: string;
  phone_e164: string;
  existing_customer_id: string;
  existing_name: string;
}

export interface RejectOutcome {
  action: "reject";
  row_number: number;
  name: string;
  phone: string;
  reason: string;
}

export type PreviewRowOutcome = CreateOutcome | MergeOutcome | RejectOutcome;

// Permissive RFC-ish email pattern — same shape Zod uses by default.
// Matches one local part + one `@` + a domain with at least one dot.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ClassifyContext {
  /**
   * Phones already classified as `create` earlier in the same upload.
   * The classifier adds to this set as it processes each row; the API
   * layer seeds it empty and reuses the same set across calls.
   */
  seenPhones: Set<string>;
}

/**
 * Classify a single parsed CSV row.
 *
 * @param row             — parsed cell values (already trimmed by the parser).
 * @param normalizedPhone — `normalizeMyPhone(row.phone)` result.
 * @param existing        — DB lookup: live customer with this phone, or null.
 * @param ctx             — running upload state (seen-phone set).
 */
export function classifyRow(
  row: ParsedRow,
  normalizedPhone: string | null,
  existing: DedupCheck,
  ctx: ClassifyContext,
): PreviewRowOutcome {
  const name = row.name.trim();
  const phoneRaw = row.phone.trim();

  if (name.length === 0) {
    return {
      action: "reject",
      row_number: row.row_number,
      name,
      phone: phoneRaw,
      reason: "missing name",
    };
  }
  if (phoneRaw.length === 0) {
    return {
      action: "reject",
      row_number: row.row_number,
      name,
      phone: phoneRaw,
      reason: "missing phone",
    };
  }
  if (normalizedPhone === null) {
    return {
      action: "reject",
      row_number: row.row_number,
      name,
      phone: phoneRaw,
      reason: `invalid phone "${phoneRaw}" — use +60… or local 0… format`,
    };
  }
  if (row.email.trim().length > 0 && !EMAIL_RE.test(row.email.trim())) {
    return {
      action: "reject",
      row_number: row.row_number,
      name,
      phone: phoneRaw,
      reason: `invalid email "${row.email}"`,
    };
  }
  if (ctx.seenPhones.has(normalizedPhone)) {
    return {
      action: "reject",
      row_number: row.row_number,
      name,
      phone: phoneRaw,
      reason: `duplicate phone within upload (${normalizedPhone})`,
    };
  }

  if (existing) {
    if (normalizeName(existing.name) === normalizeName(name)) {
      return {
        action: "merge",
        row_number: row.row_number,
        name,
        phone_e164: normalizedPhone,
        existing_customer_id: existing.id,
        existing_name: existing.name,
      };
    }
    return {
      action: "reject",
      row_number: row.row_number,
      name,
      phone: phoneRaw,
      reason: `phone ${normalizedPhone} already belongs to "${existing.name}"; you imported as "${name}". Fix the CSV row and re-upload.`,
    };
  }

  ctx.seenPhones.add(normalizedPhone);

  return {
    action: "create",
    row_number: row.row_number,
    name,
    phone_e164: normalizedPhone,
    email: row.email.trim() || null,
    address: row.address.trim() || null,
    notes: row.notes.trim() || null,
    manual_tags: row.manual_tags,
  };
}

/**
 * Summary counts derived from a list of outcomes.
 */
export interface PreviewSummary {
  total: number;
  created: number;
  merged: number;
  rejected: number;
}

export function summarize(outcomes: readonly PreviewRowOutcome[]): PreviewSummary {
  let created = 0;
  let merged = 0;
  let rejected = 0;
  for (const o of outcomes) {
    if (o.action === "create") created += 1;
    else if (o.action === "merge") merged += 1;
    else rejected += 1;
  }
  return {
    total: outcomes.length,
    created,
    merged,
    rejected,
  };
}
