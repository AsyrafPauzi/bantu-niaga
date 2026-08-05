"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Link2,
  Package,
  Pencil,
  Pin,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AdminDocBuilderTeaser } from "@/components/admin/AdminDocBuilderTeaser";
import type { AdminInternalNote } from "@/lib/admin/notes-load";
import type { NoteLinkOption } from "@/lib/admin/notes-link-options";
import {
  fillTemplatePlaceholders,
  type TemplateFillContext,
} from "@/lib/admin/template-fill";
import {
  templateCategoryLabel,
  templatePreviewLine,
  type AdminDocumentTemplate,
} from "@/lib/admin/template-shared";
import { fmtRelTime } from "@/lib/utils/relative-time";
import {
  ModuleListPanel,
  ModuleListPanelHeader,
  ModuleListRows,
} from "@/components/dashboard/module-list-panel";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  DOCUMENTS_DEFAULT_PAGE_SIZE,
  DOCUMENTS_PAGE_SIZE_OPTIONS,
  paginateArray,
  parsePagination,
  totalPages,
} from "@/lib/pagination";
import { cn } from "@/lib/utils/cn";

type TabKey = "templates" | "notes";

const BASE_PATH = "/admin/documents";

const CATEGORY_STYLES: Record<
  string,
  { icon: typeof FileText; badge: string; accent: string }
> = {
  compliance: {
    icon: ShieldCheck,
    badge:
      "bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50",
    accent: "border-l-amber-400",
  },
  finance: {
    icon: Banknote,
    badge:
      "bg-emerald-50 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/50",
    accent: "border-l-emerald-400",
  },
  operations: {
    icon: Package,
    badge:
      "bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/50",
    accent: "border-l-sky-400",
  },
  general: {
    icon: FileText,
    badge:
      "bg-violet-50 text-violet-800 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900/50",
    accent: "border-l-violet-400",
  },
  hr: {
    icon: Users,
    badge:
      "bg-rose-50 text-rose-800 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/50",
    accent: "border-l-rose-400",
  },
};

function categoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ?? {
      icon: FileText,
      badge:
        "bg-cream-100 text-ink-muted ring-cream-200 dark:bg-hairline-dark/60 dark:text-cream-400 dark:ring-hairline-dark",
      accent: "border-l-cream-300 dark:border-l-hairline-dark",
    }
  );
}

function sortNotes(notes: AdminInternalNote[]): AdminInternalNote[] {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

function searchParamsRecord(
  searchParams: URLSearchParams,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function AdminDocumentsClient({
  templates,
  initialNotes,
  canManageNotes,
  currentUserName,
  templateContext,
  linkOptions,
}: {
  templates: AdminDocumentTemplate[];
  initialNotes: AdminInternalNote[];
  canManageNotes: boolean;
  currentUserName: string;
  templateContext: TemplateFillContext;
  linkOptions: NoteLinkOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tab: TabKey =
    searchParams.get("tab") === "notes" ? "notes" : "templates";
  const search = searchParams.get("q") ?? "";
  const categoryFilter = searchParams.get("category") ?? "all";
  const pagination = parsePagination(searchParamsRecord(searchParams), {
    defaultPageSize: DOCUMENTS_DEFAULT_PAGE_SIZE,
    allowedPageSizes: DOCUMENTS_PAGE_SIZE_OPTIONS,
  });

  const listFilters = useMemo(
    () => ({
      tab: tab === "notes" ? "notes" : undefined,
      q: search || undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      pageSize:
        pagination.pageSize !== DOCUMENTS_DEFAULT_PAGE_SIZE
          ? String(pagination.pageSize)
          : undefined,
    }),
    [tab, search, categoryFilter, pagination.pageSize],
  );

  function updateListParams(
    updates: Record<string, string | undefined>,
    resetPage = true,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const categories = useMemo(
    () => Array.from(new Set(templates.map((t) => t.category))).sort(),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (categoryFilter !== "all" && template.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        template.title.toLowerCase().includes(q) ||
        template.body_text.toLowerCase().includes(q) ||
        templateCategoryLabel(template.category).toLowerCase().includes(q)
      );
    });
  }, [templates, search, categoryFilter]);

  const templatePage = Math.min(
    pagination.page,
    totalPages(filteredTemplates.length, pagination.pageSize),
  );
  const pagedTemplates = paginateArray(
    filteredTemplates,
    templatePage,
    pagination.pageSize,
  ).items;

  const sortedNotes = useMemo(() => sortNotes(notes), [notes]);
  const notesPage = Math.min(
    pagination.page,
    totalPages(sortedNotes.length, pagination.pageSize),
  );
  const pagedNotes = paginateArray(
    sortedNotes,
    notesPage,
    pagination.pageSize,
  ).items;

  function filledBody(template: AdminDocumentTemplate): string {
    return fillTemplatePlaceholders(template.body_text, templateContext);
  }

  async function copyTemplate(template: AdminDocumentTemplate) {
    try {
      await navigator.clipboard.writeText(filledBody(template));
      setCopiedSlug(template.slug);
      window.setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  async function patchNote(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<boolean> {
    setError(null);
    const res = await fetch(`/api/admin/notes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      setError(json?.error?.message ?? "Could not update note.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    const res = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: trimmed }),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { id: string; body: string; created_at: string };
      error?: { message?: string };
    } | null;
    if (!res.ok || !json?.data) {
      setError(json?.error?.message ?? "Could not save note.");
      return;
    }
    const now = json.data!.created_at;
    setNotes((prev) =>
      sortNotes([
        {
          id: json.data!.id,
          body: json.data!.body,
          created_at: now,
          updated_at: now,
          author_name: currentUserName,
          is_pinned: false,
          linked_task_id: null,
          linked_compliance_id: null,
          linked_task_title: null,
          linked_compliance_title: null,
        },
        ...prev,
      ]),
    );
    setBody("");
    updateListParams({ tab: "notes" });
    startTransition(() => router.refresh());
  }

  async function saveEdit(id: string) {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    const ok = await patchNote(id, { body: trimmed });
    if (!ok) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, body: trimmed } : n)),
    );
    setEditingId(null);
    setEditBody("");
  }

  async function togglePin(note: AdminInternalNote) {
    const ok = await patchNote(note.id, { is_pinned: !note.is_pinned });
    if (!ok) return;
    setNotes((prev) =>
      sortNotes(
        prev.map((n) =>
          n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n,
        ),
      ),
    );
  }

  async function updateLink(note: AdminInternalNote, value: string) {
    const patch =
      value === ""
        ? { linked_task_id: null, linked_compliance_id: null }
        : value.startsWith("task:")
          ? {
              linked_task_id: value.slice(5),
              linked_compliance_id: null,
            }
          : {
              linked_compliance_id: value.slice(11),
              linked_task_id: null,
            };

    const ok = await patchNote(note.id, patch);
    if (!ok) return;

    const option = linkOptions.find(
      (o) =>
        (o.kind === "task" && value === `task:${o.id}`) ||
        (o.kind === "compliance" && value === `compliance:${o.id}`),
    );

    setNotes((prev) =>
      sortNotes(
        prev.map((n) =>
          n.id === note.id
            ? {
                ...n,
                linked_task_id:
                  "linked_task_id" in patch
                    ? (patch.linked_task_id as string | null)
                    : n.linked_task_id,
                linked_compliance_id:
                  "linked_compliance_id" in patch
                    ? (patch.linked_compliance_id as string | null)
                    : n.linked_compliance_id,
                linked_task_title:
                  option?.kind === "task" ? option.label : null,
                linked_compliance_title:
                  option?.kind === "compliance" ? option.label : null,
              }
            : n,
        ),
      ),
    );
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    setError(null);
    const res = await fetch(`/api/admin/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(json?.error?.message ?? "Could not delete note.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    startTransition(() => router.refresh());
  }

  async function copyNote(note: AdminInternalNote) {
    try {
      await navigator.clipboard.writeText(note.body);
    } catch {
      setError("Could not copy note.");
    }
  }

  function downloadNote(note: AdminInternalNote) {
    const blob = new Blob([note.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `note-${note.id.slice(0, 8)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function noteLinkValue(note: AdminInternalNote): string {
    if (note.linked_task_id) return `task:${note.linked_task_id}`;
    if (note.linked_compliance_id) return `compliance:${note.linked_compliance_id}`;
    return "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => updateListParams({ tab: undefined })}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            tab === "templates"
              ? "bg-brand-700 text-white shadow-sm dark:bg-brand-500"
              : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-hairline-dark/60 dark:text-cream-300 dark:hover:bg-hairline-dark",
          )}
        >
          <FileText className="h-4 w-4" strokeWidth={2} />
          Templates
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] tabular-nums",
              tab === "templates"
                ? "bg-white/20 text-white"
                : "bg-white text-ink-muted dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            {templates.length}
          </span>
        </button>
        {canManageNotes ? (
          <button
            type="button"
            onClick={() => updateListParams({ tab: "notes" })}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === "notes"
                ? "bg-brand-700 text-white shadow-sm dark:bg-brand-500"
                : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-hairline-dark/60 dark:text-cream-300 dark:hover:bg-hairline-dark",
            )}
          >
            <StickyNote className="h-4 w-4" strokeWidth={2} />
            Internal notes
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] tabular-nums",
                tab === "notes"
                  ? "bg-white/20 text-white"
                  : "bg-white text-ink-muted dark:bg-panel-dark dark:text-cream-400",
              )}
            >
              {notes.length}
            </span>
          </button>
        ) : null}
      </div>

      {tab === "templates" ? (
        <div className="space-y-3">
          <AdminDocBuilderTeaser />
          <ModuleListPanel>
            <ModuleListPanelHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative min-w-0 flex-1 sm:max-w-sm">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                    strokeWidth={2}
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) =>
                      updateListParams({ q: e.target.value || undefined })
                    }
                    placeholder="Search templates…"
                    className="w-full rounded-lg border border-cream-300 bg-cream-50/60 py-2 pl-9 pr-3 text-sm text-ink outline-none ring-brand-500/30 placeholder:text-ink-subtle focus:border-brand-400 focus:ring-2 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPill
                    active={categoryFilter === "all"}
                    onClick={() => updateListParams({ category: undefined })}
                    label="All"
                  />
                  {categories.map((category) => (
                    <FilterPill
                      key={category}
                      active={categoryFilter === category}
                      onClick={() => updateListParams({ category })}
                      label={templateCategoryLabel(category)}
                    />
                  ))}
                </div>
              </div>
            </ModuleListPanelHeader>

            {filteredTemplates.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-ink-muted dark:text-cream-400">
                No templates match your search.
              </div>
            ) : (
              <>
                <ModuleListRows>
                  {pagedTemplates.map((template) => {
                  const style = categoryStyle(template.category);
                  const Icon = style.icon;
                  const isExpanded = expandedSlug === template.slug;
                  const isCopied = copiedSlug === template.slug;
                  const preview = filledBody(template);

                  return (
                    <div
                      key={template.id}
                      className={cn(
                        "border-l-4 bg-panel-light transition-colors dark:bg-panel-dark",
                        style.accent,
                        isExpanded && "bg-cream-50/80 dark:bg-hairline-dark/20",
                      )}
                    >
                      <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                        <div
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                            style.badge,
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSlug(isExpanded ? null : template.slug)
                          }
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink dark:text-cream-100">
                              {template.title}
                            </p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                                style.badge,
                              )}
                            >
                              {templateCategoryLabel(template.category)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-cream-400">
                            {templatePreviewLine(preview)}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void copyTemplate(template)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                              isCopied
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                : "border-cream-300 text-ink hover:bg-cream-100 dark:border-hairline-dark dark:text-cream-200 dark:hover:bg-hairline-dark/60",
                            )}
                          >
                            {isCopied ? (
                              <Check
                                className="h-3.5 w-3.5"
                                strokeWidth={2.5}
                              />
                            ) : (
                              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                            )}
                            {isCopied ? "Copied" : "Copy filled"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSlug(isExpanded ? null : template.slug)
                            }
                            aria-expanded={isExpanded}
                            aria-label={
                              isExpanded ? "Collapse preview" : "Expand preview"
                            }
                            className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-100 hover:text-ink dark:text-cream-400 dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100"
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform duration-200",
                                isExpanded && "rotate-180",
                              )}
                              strokeWidth={2}
                            />
                          </button>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="border-t border-cream-200 px-4 pb-4 pt-3 dark:border-hairline-dark sm:px-5">
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-cream-50 p-3 font-mono text-xs leading-relaxed text-ink-muted dark:bg-hairline-dark/40 dark:text-cream-300">
                            {preview}
                          </pre>
                          <p className="mt-2 text-[11px] text-ink-subtle dark:text-cream-500">
                            Date, business name, and your name are filled
                            automatically. Other placeholders stay for you to
                            edit.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </ModuleListRows>
                <ListPagination
                  page={templatePage}
                  pageSize={pagination.pageSize}
                  total={filteredTemplates.length}
                  basePath={BASE_PATH}
                  searchParams={listFilters}
                  defaultPageSize={DOCUMENTS_DEFAULT_PAGE_SIZE}
                  pageSizeOptions={DOCUMENTS_PAGE_SIZE_OPTIONS}
                  hideOnSinglePage={false}
                />
              </>
            )}
          </ModuleListPanel>
        </div>
      ) : (
        <div className="space-y-3">
          <form
            onSubmit={(e) => void addNote(e)}
            className="rounded-xl border border-cream-300 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark"
          >
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              New note
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Follow up with landlord about tenancy renewal…"
              className="mt-2 w-full resize-y rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm text-ink outline-none ring-brand-500/30 focus:border-brand-400 focus:ring-2 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-ink-muted">
                {body.length}/4000
              </span>
              <button
                type="submit"
                disabled={pending || !body.trim()}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-400"
              >
                Save note
              </button>
            </div>
          </form>

          <ModuleListPanel>
            {sortedNotes.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-ink-muted dark:text-cream-400">
                No notes yet. Jot down renewals, follow-ups, or decisions your
                team should remember.
              </div>
            ) : (
              <>
                <ModuleListRows>
                  {pagedNotes.map((note) => {
                  const isEditing = editingId === note.id;
                  const linkValue = noteLinkValue(note);

                  return (
                    <div
                      key={note.id}
                      className={cn(
                        "px-4 py-3 sm:px-5",
                        note.is_pinned &&
                          "bg-brand-50/40 dark:bg-brand-900/15",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {note.is_pinned ? (
                            <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-200">
                              <Pin className="h-3 w-3" strokeWidth={2.5} />
                              Pinned
                            </span>
                          ) : null}
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                rows={3}
                                maxLength={4000}
                                className="w-full resize-y rounded-lg border border-cream-300 bg-cream-50/50 px-3 py-2 text-sm text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveEdit(note.id)}
                                  disabled={pending || !editBody.trim()}
                                  className="rounded-lg bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditBody("");
                                  }}
                                  className="rounded-lg border border-cream-300 px-2.5 py-1 text-xs font-semibold text-ink-muted"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm text-ink dark:text-cream-100">
                              {note.body}
                            </p>
                          )}
                          {!isEditing ? (
                            <>
                              <p className="mt-1.5 text-[11px] text-ink-muted dark:text-cream-400">
                                {note.author_name}
                                <span aria-hidden> · </span>
                                <time dateTime={note.created_at}>
                                  {fmtRelTime(note.created_at)}
                                </time>
                              </p>
                              {note.linked_task_id && note.linked_task_title ? (
                                <Link
                                  href={`/admin/tasks?task=${note.linked_task_id}`}
                                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
                                >
                                  <Link2 className="h-3 w-3" strokeWidth={2} />
                                  Task: {note.linked_task_title}
                                </Link>
                              ) : null}
                              {note.linked_compliance_id &&
                              note.linked_compliance_title ? (
                                <Link
                                  href="/admin/compliance"
                                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-200"
                                >
                                  <Link2 className="h-3 w-3" strokeWidth={2} />
                                  Compliance: {note.linked_compliance_title}
                                </Link>
                              ) : null}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <select
                                  value={linkValue}
                                  onChange={(e) =>
                                    void updateLink(note, e.target.value)
                                  }
                                  disabled={pending}
                                  className="max-w-full rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                                  aria-label="Link note to task or compliance"
                                >
                                  <option value="">No link</option>
                                  {linkOptions.some((o) => o.kind === "task") ? (
                                    <optgroup label="Tasks">
                                      {linkOptions
                                        .filter((o) => o.kind === "task")
                                        .map((o) => (
                                          <option
                                            key={o.id}
                                            value={`task:${o.id}`}
                                          >
                                            {o.label}
                                          </option>
                                        ))}
                                    </optgroup>
                                  ) : null}
                                  {linkOptions.some(
                                    (o) => o.kind === "compliance",
                                  ) ? (
                                    <optgroup label="Compliance">
                                      {linkOptions
                                        .filter((o) => o.kind === "compliance")
                                        .map((o) => (
                                          <option
                                            key={o.id}
                                            value={`compliance:${o.id}`}
                                          >
                                            {o.label}
                                          </option>
                                        ))}
                                    </optgroup>
                                  ) : null}
                                </select>
                              </div>
                            </>
                          ) : null}
                        </div>
                        {!isEditing ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <IconButton
                              label={
                                note.is_pinned ? "Unpin note" : "Pin note"
                              }
                              onClick={() => void togglePin(note)}
                              active={note.is_pinned}
                            >
                              <Pin className="h-4 w-4" strokeWidth={2} />
                            </IconButton>
                            <IconButton
                              label="Edit note"
                              onClick={() => {
                                setEditingId(note.id);
                                setEditBody(note.body);
                              }}
                            >
                              <Pencil className="h-4 w-4" strokeWidth={2} />
                            </IconButton>
                            <IconButton
                              label="Copy note"
                              onClick={() => void copyNote(note)}
                            >
                              <Copy className="h-4 w-4" strokeWidth={2} />
                            </IconButton>
                            <IconButton
                              label="Download note"
                              onClick={() => downloadNote(note)}
                            >
                              <Download className="h-4 w-4" strokeWidth={2} />
                            </IconButton>
                            <IconButton
                              label="Delete note"
                              onClick={() => void deleteNote(note.id)}
                              danger
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={2} />
                            </IconButton>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditBody("");
                            }}
                            className="shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-cream-100"
                            aria-label="Cancel edit"
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </ModuleListRows>
                <ListPagination
                  page={notesPage}
                  pageSize={pagination.pageSize}
                  total={sortedNotes.length}
                  basePath={BASE_PATH}
                  searchParams={listFilters}
                  defaultPageSize={DOCUMENTS_DEFAULT_PAGE_SIZE}
                  pageSizeOptions={DOCUMENTS_PAGE_SIZE_OPTIONS}
                  hideOnSinglePage={false}
                />
              </>
            )}
          </ModuleListPanel>
        </div>
      )}

      {error ? (
        <p className="text-sm text-status-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        active
          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          : danger
            ? "text-ink-muted hover:bg-cream-100 hover:text-status-danger dark:hover:bg-hairline-dark/60"
            : "text-ink-muted hover:bg-cream-100 hover:text-ink dark:hover:bg-hairline-dark/60 dark:hover:text-cream-100",
      )}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "bg-ink text-white dark:bg-cream-100 dark:text-ink"
          : "bg-cream-100 text-ink-muted hover:bg-cream-200 dark:bg-hairline-dark/60 dark:text-cream-300 dark:hover:bg-hairline-dark",
      )}
    >
      {label}
    </button>
  );
}
