export interface AdminDocumentTemplate {
  id: string;
  slug: string;
  title: string;
  category: string;
  body_text: string;
  sort_order: number;
}

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  compliance: "Compliance",
  finance: "Finance",
  operations: "Operations",
  hr: "HR",
  general: "General",
};

export function templateCategoryLabel(category: string): string {
  return TEMPLATE_CATEGORY_LABELS[category] ?? category;
}

export function templatePreviewLine(body: string, max = 72): string {
  const line = body
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return "Empty template";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function templateCategories(
  templates: AdminDocumentTemplate[],
): string[] {
  return Array.from(new Set(templates.map((t) => t.category))).sort();
}
