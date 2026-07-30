"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { sanitizeTaskDescription } from "@/lib/admin/task-html";

interface SimpleRichTextEditorProps {
  id: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  optional?: boolean;
  className?: string;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-cream-200 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark dark:hover:text-cream-100"
    >
      {children}
    </button>
  );
}

export function SimpleRichTextEditor({
  id,
  label,
  value,
  onChange,
  placeholder = "Add notes, checklist items, or links…",
  optional = true,
  className,
}: SimpleRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const syncFromEditor = useCallback(() => {
    const raw = editorRef.current?.innerHTML ?? "";
    onChange(sanitizeTaskDescription(raw));
  }, [onChange]);

  const exec = useCallback(
    (command: string, commandValue?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, commandValue);
      syncFromEditor();
    },
    [syncFromEditor],
  );

  const addLink = useCallback(() => {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return;
      }
      exec("createLink", parsed.toString());
    } catch {
      // Invalid URL — ignore.
    }
  }, [exec]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const safe = sanitizeTaskDescription(value);
    if (el.innerHTML !== safe) {
      el.innerHTML = safe;
    }
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-ink dark:text-cream-100">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-ink-muted dark:text-cream-400">
            (optional)
          </span>
        ) : null}
      </label>
      <div className="overflow-hidden rounded-lg border border-cream-300 bg-cream-50/50 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200 dark:border-hairline-dark dark:bg-hairline-dark/30 dark:focus-within:ring-brand-800">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-cream-200 px-2 py-1.5 dark:border-hairline-dark">
          <ToolbarButton label="Bold" onClick={() => exec("bold")}>
            <Bold className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => exec("italic")}>
            <Italic className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => exec("underline")}>
            <Underline className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-cream-300 dark:bg-hairline-dark" />
          <ToolbarButton
            label="Bullet list"
            onClick={() => exec("insertUnorderedList")}
          >
            <List className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            onClick={() => exec("insertOrderedList")}
          >
            <ListOrdered className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton label="Insert link" onClick={addLink}>
            <Link2 className="h-4 w-4" strokeWidth={2} />
          </ToolbarButton>
        </div>
        <div
          id={id}
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          className={cn(
            "min-h-[120px] px-3 py-2.5 text-sm leading-relaxed text-ink outline-none dark:text-cream-100",
            "empty:before:pointer-events-none empty:before:text-ink-muted empty:before:content-[attr(data-placeholder)]",
            "dark:empty:before:text-cream-500",
            "[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline dark:[&_a]:text-brand-200",
            "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
            "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_p]:my-1",
          )}
        />
      </div>
      <p className="text-[11px] text-ink-muted dark:text-cream-400">
        Use the toolbar for bold, lists, and links. Details appear on the task
        card.
      </p>
    </div>
  );
}
