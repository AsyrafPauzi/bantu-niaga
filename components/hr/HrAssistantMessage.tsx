import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const ALLOWED_PATH_PREFIXES = [
  "/hr",
  "/settings",
  "/marketplace",
  "/home",
  "/more",
] as const;

function isSafeInternalHref(href: string): boolean {
  const path = href.split("?")[0].split("#")[0];
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  return ALLOWED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
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
        <strong key={`${keyPrefix}-b-${part++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        if (isSafeInternalHref(href)) {
          nodes.push(
            <Link
              key={`${keyPrefix}-a-${part++}`}
              href={href}
              className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-200"
            >
              {label}
            </Link>,
          );
        } else {
          nodes.push(label);
        }
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes.length > 0 ? nodes : [text];
}

function renderList(lines: string[], keyPrefix: string): ReactNode {
  return (
    <ul
      className="my-2 list-disc space-y-1.5 pl-5 first:mt-0 last:mb-0"
    >
      {lines.map((line, li) => (
        <li key={`${keyPrefix}-li-${li}`} className="leading-relaxed">
          {renderInline(line.replace(/^[-*•]\s+/, ""), `${keyPrefix}-li-${li}`)}
        </li>
      ))}
    </ul>
  );
}

function renderBlock(block: string, index: number): ReactNode {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const listLines = lines.filter((line) => /^[-*•]\s+/.test(line));
  const introLines = lines.filter((line) => !/^[-*•]\s+/.test(line));

  if (listLines.length > 0 && introLines.length > 0) {
    return (
      <div key={`block-${index}`} className="my-2 first:mt-0 last:mb-0">
        {introLines.map((line, li) => (
          <p key={`intro-${index}-${li}`} className="mb-2 leading-relaxed last:mb-2">
            {renderInline(line, `intro-${index}-${li}`)}
          </p>
        ))}
        {renderList(listLines, `block-${index}`)}
      </div>
    );
  }

  if (listLines.length === lines.length) {
    return (
      <div key={`block-${index}`}>{renderList(listLines, `block-${index}`)}</div>
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
          {renderInline(line, `p-${index}-${li}`)}
        </span>
      ))}
    </p>
  );
}

interface HrAssistantMessageProps {
  content: string;
  className?: string;
}

/** Safe subset of Markdown for HR assistant replies (lists, bold, internal links). */
export function HrAssistantMessage({
  content,
  className,
}: HrAssistantMessageProps) {
  const normalized = content.trim();
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
      {blocks.map((block, i) => renderBlock(block.trim(), i))}
    </div>
  );
}
