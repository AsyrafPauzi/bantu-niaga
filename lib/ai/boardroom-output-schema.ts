import { z } from "zod";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";

const boardroomAgentIdSchema = z.enum([
  "finance",
  "operations",
  "marketing",
  "sales",
  "hr",
  "admin",
]);

export const agentNumberRowSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(80),
});

export const agentStructuredOutputSchema = z.object({
  headline: z.string().min(1).max(120),
  /** Set when replying after colleagues — agree/disagree in one sentence. */
  peer_response: z.string().max(300).optional(),
  numbers: z.array(agentNumberRowSchema).max(4).default([]),
  problem: z.string().min(1).max(300),
  actions: z.array(z.string().min(1).max(200)).min(1).max(3),
  ask_owner: z.string().max(200).optional(),
});

export type AgentStructuredOutput = z.infer<typeof agentStructuredOutputSchema>;

export const priorityActionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  owner_agent: boardroomAgentIdSchema,
  rationale: z.string().min(1).max(200),
  link_href: z.string().max(500).optional(),
});

export type BoardroomPriorityAction = z.infer<typeof priorityActionSchema>;

export const chairRecommendationSchema = z.object({
  verdict: z.string().min(1).max(400),
  priority_actions: z.array(priorityActionSchema).max(4).default([]),
  uncertainty_note: z.string().max(200).optional(),
});

export type ChairRecommendation = z.infer<typeof chairRecommendationSchema>;

export const confidenceEvaluationSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string().min(1).max(300),
  gaps: z.array(z.string().max(200)).max(5).default([]),
});

export type ConfidenceEvaluation = z.infer<typeof confidenceEvaluationSchema>;

export type MeetingMode = "normal" | "depth";

export interface DepthSpeakerDecision {
  agentId: string;
  stance: "silent" | "clarify" | "speak";
  clarifyQuestion?: string;
}

export interface DepthState {
  round: number;
  confidence: number;
  credits_since_checkpoint: number;
  paused_at_checkpoint: boolean;
  owner_constraint?: string;
  /** Cached classify result so depth continue/accept does not re-classify. */
  speaker_decisions?: DepthSpeakerDecision[];
}

export const DEPTH_CONFIDENCE_THRESHOLD = 0.8;
export const DEPTH_CHECKPOINT_CREDITS = 10;
export const DEPTH_MAX_ROUNDS = 8;

export function parseAgentStructuredOutput(
  raw: unknown,
): AgentStructuredOutput | null {
  const result = agentStructuredOutputSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseChairRecommendation(
  raw: unknown,
): ChairRecommendation | null {
  const result = chairRecommendationSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseConfidenceEvaluation(
  raw: unknown,
): ConfidenceEvaluation | null {
  const result = confidenceEvaluationSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return tryParseJson(repairTruncatedJson(candidate));
  return tryParseJson(jsonMatch[0]) ?? tryParseJson(repairTruncatedJson(jsonMatch[0]));
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Close common truncation patterns from LLM output. */
function repairTruncatedJson(text: string): string {
  let s = text.trim();
  const start = s.indexOf("{");
  if (start < 0) return s;
  s = s.slice(start);
  const openBraces = (s.match(/\{/g) ?? []).length;
  const closeBraces = (s.match(/\}/g) ?? []).length;
  const openBrackets = (s.match(/\[/g) ?? []).length;
  const closeBrackets = (s.match(/\]/g) ?? []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) s += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) s += "}";
  return s;
}

/** Parse agent JSON from raw model text; returns null if unrecoverable. */
export function parseAgentStructuredFromText(
  text: string,
): AgentStructuredOutput | null {
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;

  const headlineRaw = String(
    obj.headline ?? obj.Headline ?? obj.title ?? "",
  ).trim();
  const problemRaw = String(
    obj.problem ?? obj.Problem ?? obj.summary ?? headlineRaw,
  ).trim();

  const actionsRaw = Array.isArray(obj.actions)
    ? obj.actions
    : Array.isArray(obj.action)
      ? obj.action
      : typeof obj.action === "string"
        ? [obj.action]
        : [];

  const loose = {
    headline: clampText(headlineRaw, 120),
    peer_response: obj.peer_response
      ? clampText(String(obj.peer_response).trim(), 300)
      : undefined,
    numbers: Array.isArray(obj.numbers)
      ? obj.numbers
          .map((n) => {
            const row = n as Record<string, unknown>;
            return {
              label: String(row.label ?? row.name ?? "").trim(),
              value: String(row.value ?? row.amount ?? "").trim(),
            };
          })
          .filter((row) => row.label && row.value)
          .slice(0, 4)
      : [],
    problem: clampText(problemRaw, 300),
    actions: actionsRaw
      .map((a) => {
        if (typeof a === "string") return clampText(a.trim(), 200);
        if (a && typeof a === "object") {
          const row = a as Record<string, unknown>;
          return clampText(
            String(row.label ?? row.action ?? row.text ?? "").trim(),
            200,
          );
        }
        return clampText(String(a).trim(), 200);
      })
      .filter(Boolean)
      .slice(0, 3),
    ask_owner: obj.ask_owner
      ? clampText(String(obj.ask_owner).trim(), 200)
      : undefined,
  };

  if (!loose.headline && !loose.problem) return null;
  if (!loose.headline) loose.headline = clampText(loose.problem.slice(0, 80), 120);
  if (!loose.problem) loose.problem = loose.headline;
  if (loose.actions.length === 0) {
    loose.actions = ["Review the data packet and decide next step."];
  }

  return parseAgentStructuredOutput(loose);
}

function clampText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trim();
}

export function slugActionId(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "action"}-${index}`;
}

export function isBoardroomAgentId(value: string): value is BoardroomAgentId {
  return boardroomAgentIdSchema.safeParse(value).success;
}
