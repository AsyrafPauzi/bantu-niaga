/**
 * Types for the AI agent context subsystem.
 *
 * Goal: every AI invocation operates over a strictly tenant-scoped data
 * packet so the agent can never (a) read another tenant's data and
 * (b) blow the prompt budget by re-loading the whole DB on each call.
 *
 * Architecture (TL;DR):
 *
 *   getCurrentUser()  →  AgentContext        // strictly tenant-pinned
 *           │
 *           ▼
 *   buildPillarSnapshot(pillar, ctx)
 *           │             returns a compact PillarSnapshot
 *           ▼
 *   buildBriefing(pillar, ctx)
 *           │             returns a token-optimised packet ready to inline
 *           ▼          in an LLM system prompt
 *   openaiChat({ messages: [{ role: 'system', content: briefing }, …] })
 *
 * The snapshot is the *only* data the AI sees. No raw DB cursor, no SQL,
 * no service-role bypass — full stop.
 */

import type { Pillar, Role } from "@/lib/permissions";

/**
 * Identity envelope passed into every AI snapshot builder. Build it
 * once at the top of an API handler via `resolveAgentContext()`; pass
 * the resulting value by reference, never mutate.
 *
 * `businessId` is the SINGLE source of tenant scope. It is never read
 * from request bodies, query strings, or session cookies directly —
 * it always comes from `getCurrentUser()`.
 */
export interface AgentContext {
  readonly businessId: string;
  readonly userId: string;
  readonly role: Role;
  /** True when the calling identity is a platform admin viewing this tenant via impersonation. */
  readonly impersonated: boolean;
}

/** One numeric or short-text KPI surfaced to the agent. */
export interface SnapshotKpi {
  key: string;
  label: string;
  value: number | string;
  /** Optional unit suffix (e.g. 'MYR', 'days', '%'). */
  unit?: string;
  /** Optional delta vs. last period — purely cosmetic. */
  delta?: string;
}

/** A recent or notable entity row, kept tiny for token economy. */
export interface SnapshotItem {
  id: string;
  label: string;
  /** Free-form short caption — kept to <80 chars. */
  meta?: string;
  /** ISO-8601 timestamp the item is anchored to. */
  at?: string | null;
}

/** Items that need the user's attention. */
export interface SnapshotAttention {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
}

/**
 * A complete pillar overview. Designed to round-trip through JSON.stringify
 * cleanly and stay under ~2-4 KB so it can be inlined into every prompt.
 */
export interface PillarSnapshot {
  pillar: Pillar;
  businessId: string;
  generatedAt: string;
  /** Whether the snapshot has real data (true) or is a placeholder (false). */
  available: boolean;
  /** Short prose explaining what's in the snapshot — first line of the AI's system prompt. */
  headline: string;
  kpis: readonly SnapshotKpi[];
  /** At most 10 entries. The builder MUST truncate before returning. */
  recent: readonly SnapshotItem[];
  attention: readonly SnapshotAttention[];
  /**
   * Free-form prose summarising patterns the agent should know (e.g.
   * "Mostly weekend customers; no purchase in last 7 days for 4 of 8.").
   * Keep this short — under 300 chars.
   */
  notes?: string;
}

/**
 * A briefing is a snapshot rendered into a compact text form ready to
 * be dropped into the AI system prompt. Returned by `buildBriefing`.
 */
export interface BriefingPacket {
  pillar: Pillar;
  businessId: string;
  /** Token-economical text representation (~150-400 tokens typically). */
  text: string;
  /** Original snapshot for callers that prefer to template themselves. */
  snapshot: PillarSnapshot;
}
