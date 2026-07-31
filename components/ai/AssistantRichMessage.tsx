import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  formatAssistantReply,
  SUCCESS_LINE,
} from "@/lib/ai/assistant-reply";
import { cn } from "@/lib/utils/cn";

/** Internal app paths assistants may link to in Markdown replies. */
export const ASSISTANT_PATH_PREFIXES = {
  finance: [
    "/finance",
    "/operations",
    "/settings",
    "/marketplace",
    "/home",
    "/more",
  ],
  marketing: [
    "/marketing",
    "/operations",
    "/finance",
    "/settings",
    "/marketplace",
    "/home",
    "/more",
  ],
  admin: [
    "/admin",
    "/finance",
    "/marketing",
    "/settings",
    "/marketplace",
    "/home",
    "/more",
  ],
  operations: [
    "/operations",
    "/finance",
    "/settings",
    "/marketplace",
    "/home",
    "/more",
  ],
  sales: [
    "/sales",
    "/marketing",
    "/operations",
    "/finance",
    "/settings",
    "/marketplace",
    "/home",
    "/more",
  ],
} as const;

export type AssistantMessagePillar = keyof typeof ASSISTANT_PATH_PREFIXES;

function isSafeInternalHref(
  href: string,
  allowedPrefixes: readonly string[],
): boolean {
  const path = href.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  return allowedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function friendlyPathLabel(path: string): string {
  const segment = path.split("/").filter(Boolean).pop() ?? path;
  return segment
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseMarkdownLink(
  token: string,
): { label: string; href: string } | null {
  const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
  if (!linkMatch) return null;

  let label = linkMatch[1] ?? "";
  let href = linkMatch[2] ?? "";

  const inner = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(label);
  if (inner) {
    label = inner[1] ?? label;
    href = inner[2] ?? href;
  }

  if (label.startsWith("/")) {
    label = friendlyPathLabel(label);
  }

  return { label, href };
}

function renderInline(
  text: string,
  keyPrefix: string,
  allowedPrefixes: readonly string[],
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let part = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong
          key={`${keyPrefix}-b-${part++}`}
          className="font-semibold text-ink dark:text-cream-50"
        >
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${part++}`}
          className="rounded bg-cream-100 px-1 py-0.5 font-mono text-[0.85em] text-ink dark:bg-panel-dark dark:text-cream-100"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const parsed = parseMarkdownLink(token);
      if (parsed && isSafeInternalHref(parsed.href, allowedPrefixes)) {
        nodes.push(
          <Link
            key={`${keyPrefix}-a-${part++}`}
            href={parsed.href}
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300"
          >
            {parsed.label}
          </Link>,
        );
      } else {
        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
        nodes.push(linkMatch?.[1] ?? token);
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes.length > 0 ? nodes : [text];
}

function renderList(
  lines: string[],
  keyPrefix: string,
  allowedPrefixes: readonly string[],
  card = false,
): ReactNode {
  const list = (
    <ul className="list-none space-y-2 p-0">
      {lines.map((line, li) => (
        <li
          key={`${keyPrefix}-li-${li}`}
          className="flex gap-2 leading-relaxed before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-brand-400 before:content-['']"
        >
          <span className="min-w-0 flex-1">
            {renderInline(
              line.replace(/^[-*•]\s+/, ""),
              `${keyPrefix}-li-${li}`,
              allowedPrefixes,
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  if (!card) {
    return (
      <ul className="my-2 list-disc space-y-1.5 pl-5 first:mt-0 last:mb-0">
        {lines.map((line, li) => (
          <li key={`${keyPrefix}-li-${li}`} className="leading-relaxed">
            {renderInline(
              line.replace(/^[-*•]\s+/, ""),
              `${keyPrefix}-li-${li}`,
              allowedPrefixes,
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
      {list}
    </div>
  );
}

function isSectionHeading(line: string): boolean {
  return /^\*\*[^*]+\*\*:?$/.test(line.trim());
}

function isNextStepBlock(block: string): boolean {
  return /^\*\*(?:Langkah seterusnyo?|Seterusnya|Next steps?|Next step|下一步|后续步骤|அடுத்த படி|அடுத்த நடவடிக்கை)[^*]*:\*\*/i.test(
    block.trim().split("\n")[0] ?? "",
  );
}

function nextStepHeading(block: string): string {
  const match = /^\*\*([^*]+):\*\*/.exec(block.trim().split("\n")[0] ?? "");
  return match?.[1]?.trim() || "Next step";
}

function renderBlock(
  block: string,
  index: number,
  allowedPrefixes: readonly string[],
): ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  if (trimmed === "---") {
    return (
      <hr
        key={`hr-${index}`}
        className="my-4 border-0 border-t border-[#E5E0D8] dark:border-hairline-dark"
      />
    );
  }

  if (isNextStepBlock(trimmed)) {
    const body = trimmed.replace(/^\*\*[^*]+:\*\*\s*/i, "").trim();
    return (
      <div
        key={`next-${index}`}
        className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-3 dark:border-amber-900/40 dark:bg-amber-950/25"
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          {nextStepHeading(trimmed)}
        </p>
        <p className="text-sm leading-relaxed text-ink dark:text-cream-100">
          {renderInline(body, `next-${index}`, allowedPrefixes)}
        </p>
      </div>
    );
  }

  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0] ?? "";
  if (SUCCESS_LINE.test(firstLine)) {
    const rest = lines.slice(1);
    return (
      <div key={`success-${index}`} className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/40">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {renderInline(
              firstLine.replace(/^✅\s*/, ""),
              `success-${index}`,
              allowedPrefixes,
            )}
          </p>
        </div>
        {rest.length > 0
          ? renderBlock(rest.join("\n"), index + 1000, allowedPrefixes)
          : null}
      </div>
    );
  }

  const listLines = lines.filter((line) => /^[-*•]\s+/.test(line));
  const introLines = lines.filter((line) => !/^[-*•]\s+/.test(line));
  const summaryCard =
    introLines.some((line) =>
      /ringkasan|summary|transaksi|pelanggan|customer|tugas|task|compliance|lesen/i.test(
        line,
      ),
    ) && listLines.length > 0;

  if (listLines.length > 0 && introLines.length > 0) {
    return (
      <div key={`block-${index}`} className="my-3 first:mt-0 last:mb-0">
        {introLines.map((line, li) =>
          isSectionHeading(line) ? (
            <p
              key={`h-${index}-${li}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400"
            >
              {renderInline(
                line.replace(/\*\*/g, ""),
                `h-${index}-${li}`,
                allowedPrefixes,
              )}
            </p>
          ) : (
            <p
              key={`intro-${index}-${li}`}
              className="mb-2 leading-relaxed last:mb-2"
            >
              {renderInline(line, `intro-${index}-${li}`, allowedPrefixes)}
            </p>
          ),
        )}
        {renderList(listLines, `block-${index}`, allowedPrefixes, summaryCard)}
      </div>
    );
  }

  if (listLines.length === lines.length) {
    return (
      <div key={`block-${index}`} className="my-2">
        {renderList(listLines, `block-${index}`, allowedPrefixes, summaryCard)}
      </div>
    );
  }

  return (
    <p
      key={`block-${index}`}
      className="my-2 leading-relaxed first:mt-0 last:mb-0"
    >
      {lines.map((line, li) => (
        <span key={`p-${index}-${li}`}>
          {li > 0 ? <br /> : null}
          {renderInline(line, `p-${index}-${li}`, allowedPrefixes)}
        </span>
      ))}
    </p>
  );
}

interface AssistantRichMessageProps {
  content: string;
  pillar: AssistantMessagePillar;
  className?: string;
}

/**
 * Shared rich Markdown renderer for staff AI assistants — success banners,
 * section cards, internal links, multi-language next-step headings.
 */
export function AssistantRichMessage({
  content,
  pillar,
  className,
}: AssistantRichMessageProps) {
  const allowedPrefixes = ASSISTANT_PATH_PREFIXES[pillar];
  const normalized = formatAssistantReply(content.trim());
  const blocks = normalized.split(/\n{2,}/).filter((b) => b.trim());

  if (blocks.length === 0) {
    return (
      <p className={cn("whitespace-pre-wrap leading-relaxed", className)}>
        {content}
      </p>
    );
  }

  return (
    <div className={cn("text-sm break-words [&_a]:break-words", className)}>
      {blocks.map((block, i) =>
        renderBlock(block.trim(), i, allowedPrefixes),
      )}
    </div>
  );
}
