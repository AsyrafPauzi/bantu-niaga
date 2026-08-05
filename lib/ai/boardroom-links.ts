import "server-only";

import type { BoardroomAgentId } from "@/lib/ai/boardroom-shared";
import type { BoardroomPendingAction } from "@/lib/ai/boardroom-actions";
import type {
  BoardroomPriorityAction,
  ChairRecommendation,
} from "@/lib/ai/boardroom-output-schema";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ORD_RE = /\b(ORD-\d{4}-\d{3,6})\b/i;
const INV_RE = /\b(INV-\d{4}-\d{3,6})\b/i;

const ALLOWED_LIST_PATHS = new Set([
  "/finance/invoices",
  "/finance/expenses",
  "/finance/customers",
  "/finance/income",
  "/operations/orders",
  "/operations/products",
  "/operations/bookings",
  "/sales/leads",
  "/sales/pos",
  "/sales/history",
  "/marketing/customers",
  "/marketing/segments",
  "/marketing/coupons",
  "/hr/employees",
  "/hr/leave",
]);

function extractRef(text: string): {
  order?: string;
  invoice?: string;
} {
  const order = text.match(ORD_RE)?.[1];
  const invoice = text.match(INV_RE)?.[1];
  return { order, invoice };
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Resolve chair action links to real in-app routes (no 404s on ORD/INV slugs). */
export async function resolveBoardroomLinkHref(opts: {
  businessId: string;
  href?: string;
  label?: string;
  ownerAgent?: BoardroomAgentId;
}): Promise<string | undefined> {
  const blob = `${opts.href ?? ""} ${opts.label ?? ""}`;
  const refs = extractRef(blob);
  const admin = createServiceRoleClient();

  if (refs.order) {
    const { data } = await admin
      .from("operations_orders")
      .select("id, number")
      .eq("business_id", opts.businessId)
      .ilike("number", refs.order)
      .is("deleted_at", null)
      .maybeSingle();
    if (data?.id) {
      return `/operations/orders?q=${encodeURIComponent(data.number ?? refs.order)}`;
    }
    return `/operations/orders?q=${encodeURIComponent(refs.order)}`;
  }

  if (refs.invoice) {
    const { data } = await admin
      .from("finance_invoices")
      .select("id, number")
      .eq("business_id", opts.businessId)
      .ilike("number", refs.invoice)
      .maybeSingle();
    if (data?.id) {
      return `/finance/invoices/${data.id}/edit`;
    }
    return `/finance/invoices?q=${encodeURIComponent(refs.invoice)}`;
  }

  const href = opts.href?.trim();
  if (!href) {
    return defaultListForAgent(opts.ownerAgent);
  }

  if (!href.startsWith("/") || href.includes("://")) {
    return defaultListForAgent(opts.ownerAgent);
  }

  const pathOnly = href.split("?")[0] ?? href;
  const segments = pathOnly.split("/").filter(Boolean);

  if (segments.length >= 3) {
    const idSegment = segments[segments.length - 1] ?? "";
    if (isUuid(idSegment)) {
      if (pathOnly.startsWith("/finance/invoices/")) {
        return `${pathOnly}/edit`.replace(/\/edit\/edit$/, "/edit");
      }
      if (pathOnly.startsWith("/sales/leads/")) {
        return pathOnly;
      }
      return undefined;
    }

    if (ORD_RE.test(idSegment)) {
      return resolveBoardroomLinkHref({
        businessId: opts.businessId,
        label: idSegment,
        ownerAgent: opts.ownerAgent,
      });
    }
    if (INV_RE.test(idSegment)) {
      return resolveBoardroomLinkHref({
        businessId: opts.businessId,
        label: idSegment,
        ownerAgent: opts.ownerAgent,
      });
    }
  }

  if (ALLOWED_LIST_PATHS.has(pathOnly)) {
    return href;
  }

  return defaultListForAgent(opts.ownerAgent);
}

function defaultListForAgent(
  agent?: BoardroomAgentId,
): string | undefined {
  switch (agent) {
    case "finance":
      return "/finance/invoices";
    case "operations":
      return "/operations/orders";
    case "sales":
      return "/sales/leads";
    case "marketing":
      return "/marketing/customers";
    case "hr":
      return "/hr/employees";
    case "admin":
      return "/admin/compliance";
    default:
      return undefined;
  }
}

export async function sanitizeChairRecommendationLinks(opts: {
  businessId: string;
  rec: ChairRecommendation;
}): Promise<ChairRecommendation> {
  const priority_actions = await Promise.all(
    opts.rec.priority_actions.map(async (action) => {
      const link_href = await resolveBoardroomLinkHref({
        businessId: opts.businessId,
        href: action.link_href,
        label: action.label,
        ownerAgent: action.owner_agent,
      });
      return link_href ? { ...action, link_href } : { ...action, link_href: undefined };
    }),
  );

  return { ...opts.rec, priority_actions };
}

export async function sanitizePriorityActionLinks(opts: {
  businessId: string;
  actions: BoardroomPriorityAction[];
}): Promise<BoardroomPriorityAction[]> {
  return Promise.all(
    opts.actions.map(async (action) => {
      const link_href = await resolveBoardroomLinkHref({
        businessId: opts.businessId,
        href: action.link_href,
        label: action.label,
        ownerAgent: action.owner_agent,
      });
      return link_href ? { ...action, link_href } : { ...action, link_href: undefined };
    }),
  );
}
