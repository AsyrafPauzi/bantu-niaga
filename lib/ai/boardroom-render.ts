import type {
  AgentStructuredOutput,
  ChairRecommendation,
} from "@/lib/ai/boardroom-output-schema";
import { parseAgentStructuredFromText } from "@/lib/ai/boardroom-output-schema";
import { resolveBoardroomDisplayName } from "@/lib/ai/boardroom-access";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";

/** Render structured agent JSON to markdown for storage and rich display. */
export function renderAgentStructuredToMarkdown(
  structured: AgentStructuredOutput,
): string {
  const lines: string[] = [];

  if (structured.peer_response?.trim()) {
    lines.push(`*${structured.peer_response.trim()}*`, "");
  }

  lines.push(`**${structured.headline.trim()}**`, "");

  const numbers = structured.numbers.filter(
    (row) => row.label.trim() && row.value.trim(),
  );
  if (numbers.length > 0) {
    lines.push("| Metric | Amount |", "| --- | --- |");
    for (const row of numbers) {
      lines.push(`| ${row.label.trim()} | ${row.value.trim()} |`);
    }
    lines.push("");
  }

  lines.push(`**Problem:** ${structured.problem.trim()}`, "", "**Do next:**");
  structured.actions.forEach((action, i) => {
    lines.push(`${i + 1}. ${action.trim()}`);
  });

  if (structured.ask_owner?.trim()) {
    lines.push("", `**Question:** ${structured.ask_owner.trim()}`);
  }

  return lines.join("\n");
}

/** Render chair recommendation to markdown (no staff summary duplication). */
export function renderChairRecommendationToMarkdown(
  rec: ChairRecommendation,
  displayNames?: Record<string, string>,
): string {
  const lines: string[] = [`**${rec.verdict.trim()}**`, ""];

  if (rec.priority_actions.length > 0) {
    rec.priority_actions.forEach((action, i) => {
      const who = resolveBoardroomDisplayName(
        action.owner_agent as BoardroomAgentId,
        displayNames,
      );
      lines.push(`${i + 1}. ${action.label.trim()} (${who})`);
    });
  }

  if (rec.uncertainty_note?.trim()) {
    lines.push("", `*${rec.uncertainty_note.trim()}*`);
  }

  return lines.join("\n");
}

/** Fallback when structured parse fails — try JSON recovery, else plain text. */
export function renderPlainAgentFallback(text: string): string {
  const recovered = parseAgentStructuredFromText(text);
  if (recovered) return renderAgentStructuredToMarkdown(recovered);

  const trimmed = stripEmbeddedJsonBlob(text).trim();
  if (!trimmed) return "No data.";

  const headline = trimmed.match(/"headline"\s*:\s*"([^"]+)"/)?.[1];
  const problem = trimmed.match(/"problem"\s*:\s*"([^"]+)"/)?.[1];
  if (headline || problem) {
    return renderAgentStructuredToMarkdown({
      headline: headline ?? problem!.slice(0, 80),
      numbers: [],
      problem: problem ?? headline ?? "See staff note above.",
      actions: ["Review the data packet and decide next step."],
    });
  }

  if (trimmed.startsWith("{") && trimmed.includes("headline")) {
    return "Could not format this reply. Please ask again.";
  }
  return trimmed;
}

/** Remove trailing JSON blob some models append after prose. */
export function stripEmbeddedJsonBlob(text: string): string {
  const idx = text.indexOf('{"headline"');
  if (idx < 0) {
    const alt = text.indexOf('{\n"headline"');
    if (alt < 0) return text;
    return text.slice(0, alt).trim();
  }
  return text.slice(0, idx).trim();
}

export function formatAgentNoteForChain(
  reply: {
    agentId: BoardroomAgentId;
    content: string;
    structured: AgentStructuredOutput | null;
  },
  displayNames?: Record<string, string>,
): string {
  const label = resolveBoardroomDisplayName(reply.agentId, displayNames);
  if (reply.structured) {
    const s = reply.structured;
    const parts: string[] = [];
    if (s.peer_response?.trim()) parts.push(s.peer_response.trim());
    parts.push(s.headline.trim());
    if (s.problem.trim()) parts.push(`Problem: ${s.problem.trim()}`);
    if (s.actions.length > 0) {
      parts.push(`Actions: ${s.actions.join("; ")}`);
    }
    return `${label}: ${parts.join(" | ")}`;
  }
  return `${label}: ${reply.content.slice(0, 400)}`;
}

export function chairMarkdownLineCount(rec: ChairRecommendation): number {
  let count = 1;
  count += rec.priority_actions.length;
  if (rec.uncertainty_note) count += 1;
  return count;
}
