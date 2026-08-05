import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Boxes,
  ClipboardList,
  Megaphone,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import { BOARDROOM_AGENTS } from "@/lib/ai/boardroom-shared";

export const BOARDROOM_AGENT_ICON: Record<BoardroomAgentId, LucideIcon> = {
  finance: Banknote,
  operations: Boxes,
  marketing: Megaphone,
  sales: ShoppingCart,
  hr: Users,
  admin: ClipboardList,
};

export const BOARDROOM_AGENT_ACCENT: Record<
  BoardroomAgentId,
  { ring: string; bg: string; text: string; chip: string }
> = {
  marketing: {
    ring: "ring-violet-400/60",
    bg: "bg-violet-100 dark:bg-violet-950/50",
    text: "text-violet-800 dark:text-violet-200",
    chip: "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40",
  },
  hr: {
    ring: "ring-teal-400/60",
    bg: "bg-teal-100 dark:bg-teal-950/50",
    text: "text-teal-800 dark:text-teal-200",
    chip: "border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40",
  },
  sales: {
    ring: "ring-blue-400/60",
    bg: "bg-blue-100 dark:bg-blue-950/50",
    text: "text-blue-800 dark:text-blue-200",
    chip: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40",
  },
  finance: {
    ring: "ring-sky-400/60",
    bg: "bg-sky-100 dark:bg-sky-950/50",
    text: "text-sky-800 dark:text-sky-200",
    chip: "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40",
  },
  operations: {
    ring: "ring-amber-400/60",
    bg: "bg-amber-100 dark:bg-amber-950/50",
    text: "text-amber-900 dark:text-amber-200",
    chip: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
  },
  admin: {
    ring: "ring-slate-400/60",
    bg: "bg-slate-100 dark:bg-slate-900/50",
    text: "text-slate-800 dark:text-slate-200",
    chip: "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40",
  },
};

export function boardroomAgentLabel(id: string): string {
  return BOARDROOM_AGENTS.find((a) => a.id === id)?.label ?? id;
}

export function resolveBoardroomDisplayName(
  id: string,
  displayNames?: Record<string, string>,
): string {
  const custom = displayNames?.[id]?.trim();
  return custom || boardroomAgentLabel(id);
}

export function boardroomAgentRole(id: string): string {
  return BOARDROOM_AGENTS.find((a) => a.id === id)?.role ?? "";
}

export function isBoardroomAgentId(id: string): id is BoardroomAgentId {
  return id in BOARDROOM_AGENT_ICON;
}

export function fmtMeetingWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
