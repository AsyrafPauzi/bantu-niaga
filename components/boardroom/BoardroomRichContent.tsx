"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AssistantRichMessage,
  type AssistantMessagePillar,
} from "@/components/ai/AssistantRichMessage";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { isBoardroomAgentId } from "@/lib/ai/boardroom-ui";
import { cn } from "@/lib/utils/cn";

const AGENT_PILLAR: Record<BoardroomAgentId, AssistantMessagePillar> = {
  finance: "finance",
  operations: "operations",
  marketing: "marketing",
  sales: "sales",
  hr: "admin",
  admin: "admin",
};

const BOARDROOM_PATH_PREFIXES = [
  "/finance",
  "/operations",
  "/marketing",
  "/sales",
  "/hr",
  "/admin",
  "/settings",
  "/home",
  "/more",
] as const;

function isTableBlock(block: string): boolean {
  const lines = block.trim().split("\n");
  return lines.length >= 2 && lines.every((l) => l.includes("|"));
}

function renderMarkdownTable(block: string, key: string): ReactNode {
  const lines = block
    .trim()
    .split("\n")
    .filter((l) => l.trim() && !/^\|?\s*[-:]+/.test(l.trim()));

  if (lines.length < 1) return null;

  const parseRow = (line: string) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return (
    <div key={key} className="my-3 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[240px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold text-white/80">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/5 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-white/75">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderSimpleInline(text: string): ReactNode {
  const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(text);
  if (linkMatch) {
    const href = linkMatch[2];
    const label = linkMatch[1];
    if (href.startsWith("/") && !href.startsWith("//")) {
      const ok = BOARDROOM_PATH_PREFIXES.some(
        (p) => href === p || href.startsWith(`${p}/`),
      );
      if (ok) {
        return (
          <Link
            href={href}
            className="font-medium text-brand-300 underline underline-offset-2"
          >
            {label}
          </Link>
        );
      }
    }
  }

  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      part.length > 2 &&
      !part.startsWith("**")
    ) {
      return (
        <em key={i} className="italic text-white/80">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function renderBlock(block: string, index: number): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  if (isTableBlock(trimmed)) {
    return renderMarkdownTable(trimmed, `table-${index}`);
  }

  if (
    trimmed.startsWith("*") &&
    trimmed.endsWith("*") &&
    !trimmed.startsWith("**") &&
    trimmed.indexOf("*", 1) === trimmed.length - 1
  ) {
    return (
      <p
        key={index}
        className="my-2 border-l-2 border-white/20 pl-3 text-sm italic leading-relaxed text-white/80"
      >
        {trimmed.slice(1, -1)}
      </p>
    );
  }

  if (trimmed.startsWith("**") && trimmed.includes(":**")) {
    return (
      <p key={index} className="my-2 leading-relaxed text-white/90">
        {renderSimpleInline(trimmed)}
      </p>
    );
  }

  const numbered = trimmed.match(/^\d+\.\s+/);
  if (numbered) {
    return (
      <p key={index} className="my-1 leading-relaxed text-white/85">
        {renderSimpleInline(trimmed)}
      </p>
    );
  }

  return (
    <p key={index} className="my-2 leading-relaxed text-white/90">
      {renderSimpleInline(trimmed)}
    </p>
  );
}

export function BoardroomRichContent({
  content,
  agentId,
  className,
}: {
  content: string;
  agentId?: string;
  className?: string;
}) {
  const pillar =
    agentId && isBoardroomAgentId(agentId)
      ? AGENT_PILLAR[agentId]
      : "finance";

  if (content.includes("| Metric |") || content.includes("| --- |")) {
    const blocks = content.split(/\n{2,}/).filter((b) => b.trim());
    return (
      <div className={cn("text-sm", className)}>
        {blocks.map((block, i) => renderBlock(block, i))}
      </div>
    );
  }

  return (
    <AssistantRichMessage
      content={content}
      pillar={pillar}
      className={cn("text-white/90 [&_strong]:text-white", className)}
    />
  );
}
