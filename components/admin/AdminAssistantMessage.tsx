import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const ALLOWED_PATH_PREFIXES = [
  "/admin",
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
  const pattern =
    /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|(?<![(\w])\/(?:admin|settings|marketplace|home|more)(?:\/[a-z0-9-]+)*)/gi;
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
        <strong key={`${keyPrefix}-b-${part++}`} className="font-semibold text-ink dark:text-cream-50">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
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
    } else if (token.startsWith("/")) {
      nodes.push(
        <Link
          key={`${keyPrefix}-p-${part++}`}
          href={token}
          className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-200"
        >
          {token}
        </Link>,
      );
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
  ordered = false,
): ReactNode {
  const checkboxLines = lines.filter((line) => /^-\s+\[[ xX]\]\s+/.test(line));
  if (checkboxLines.length === lines.length && checkboxLines.length > 0) {
    return (
      <ul className="my-2 space-y-1.5 first:mt-0 last:mb-0">
        {checkboxLines.map((line, li) => {
          const checked = /^-\s+\[[xX]\]\s+/.test(line);
          const label = line.replace(/^-\s+\[[ xX]\]\s+/, "");
          return (
            <li
              key={`${keyPrefix}-cb-${li}`}
              className="flex items-start gap-2 leading-relaxed"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                  checked
                    ? "border-status-success bg-status-success/15 text-status-success"
                    : "border-cream-400 bg-white dark:border-hairline-dark dark:bg-panel-dark",
                )}
                aria-hidden
              >
                {checked ? "✓" : ""}
              </span>
              <span>{renderInline(label, `${keyPrefix}-cb-${li}`)}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "my-2 space-y-1.5 first:mt-0 last:mb-0",
        ordered ? "list-decimal pl-5" : "list-disc pl-5",
      )}
    >
      {lines.map((line, li) => (
        <li key={`${keyPrefix}-li-${li}`} className="leading-relaxed">
          {renderInline(
            line.replace(/^(\d+\.|[-*•])\s+/, ""),
            `${keyPrefix}-li-${li}`,
          )}
        </li>
      ))}
    </Tag>
  );
}

function renderBlock(block: string, index: number): ReactNode {
  const rawLines = block.split("\n");
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const headingMatch = /^(#{1,3})\s+(.+)$/.exec(lines[0]);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const title = headingMatch[2];
    const rest = lines.slice(1);
    const HeadingTag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
    return (
      <div key={`block-${index}`} className="first:mt-0">
        <HeadingTag
          className={cn(
            "font-bold text-ink dark:text-cream-50",
            level === 1 && "mt-1 text-base",
            level === 2 && "mt-3 text-sm",
            level === 3 && "mt-2.5 text-sm",
          )}
        >
          {renderInline(title, `h-${index}`)}
        </HeadingTag>
        {rest.length > 0 ? (
          <div className="mt-1.5">{renderBlock(rest.join("\n"), index + 1000)}</div>
        ) : null}
      </div>
    );
  }

  const listLines = lines.filter(
    (line) =>
      /^[-*•]\s+/.test(line) ||
      /^\d+\.\s+/.test(line) ||
      /^-\s+\[[ xX]\]\s+/.test(line),
  );
  const introLines = lines.filter(
    (line) =>
      !/^[-*•]\s+/.test(line) &&
      !/^\d+\.\s+/.test(line) &&
      !/^-\s+\[[ xX]\]\s+/.test(line),
  );
  const ordered = listLines.length > 0 && /^\d+\.\s+/.test(listLines[0]);

  if (listLines.length > 0 && introLines.length > 0) {
    return (
      <div key={`block-${index}`} className="my-2 first:mt-0 last:mb-0">
        {introLines.map((line, li) => (
          <p
            key={`intro-${index}-${li}`}
            className="mb-2 leading-relaxed text-ink-muted dark:text-cream-300 last:mb-2"
          >
            {renderInline(line, `intro-${index}-${li}`)}
          </p>
        ))}
        {renderList(listLines, `block-${index}`, ordered)}
      </div>
    );
  }

  if (listLines.length === lines.length) {
    return (
      <div key={`block-${index}`}>
        {renderList(listLines, `block-${index}`, ordered)}
      </div>
    );
  }

  return (
    <p
      key={`block-${index}`}
      className="my-2 leading-relaxed text-ink-muted dark:text-cream-300 first:mt-0 last:mb-0"
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

interface AdminAssistantMessageProps {
  content: string;
  className?: string;
}

/** Safe subset of Markdown for Amir assistant replies. */
export function AdminAssistantMessage({
  content,
  className,
}: AdminAssistantMessageProps) {
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
    <div
      className={cn(
        "text-sm break-words [&_a]:break-words [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_h4:first-child]:mt-0",
        className,
      )}
    >
      {blocks.map((block, i) => renderBlock(block.trim(), i))}
    </div>
  );
}
