import { ADMIN_SCOPE_CORE } from "@/lib/ai/admin-assistant-prompt";
import { FINANCE_SCOPE_CORE } from "@/lib/ai/finance-assistant-prompt";
import { HR_SCOPE_CORE } from "@/lib/ai/hr-assistant-prompt";
import { MARKETING_SCOPE_CORE } from "@/lib/ai/marketing-assistant-prompt";
import { OPERATIONS_SCOPE_CORE } from "@/lib/ai/operations-assistant-prompt";
import { SALES_SCOPE_CORE } from "@/lib/ai/sales-assistant-prompt";
import type {
  AllowedAction,
  EscalationRule,
  Guardrail,
  KnowledgeSource,
} from "@/lib/super-admin/types";

export type AgentScopeSeed = {
  slug: string;
  versionLabel: string;
  defaultTone: string;
  systemPrompt: string;
  allowedActions: AllowedAction[];
  guardrails: Guardrail[];
  escalation: EscalationRule[];
  knowledgeBase: KnowledgeSource[];
};

const PLATFORM_GUARDRAILS: Guardrail[] = [
  {
    label: "Single tenant only",
    detail: "Never reference other businesses or hypothetical tenants.",
    severity: "always",
  },
  {
    label: "No invented numbers",
    detail:
      "RM amounts, counts, invoice/order/lead IDs must come from DATA PACKET or tool results.",
    severity: "always",
  },
  {
    label: "No payments or fund movement",
    detail: "Blocked at tool layer — advise only.",
    severity: "always",
  },
  {
    label: "No external PII sharing",
    detail: "Customer data stays inside this tenant unless owner explicitly sends.",
    severity: "always",
  },
  {
    label: "No guaranteed outcomes",
    detail: 'Use ranges and "may help" — never promise fixed sales or profit.',
    severity: "always",
  },
  {
    label: "No legal/tax filings advice",
    detail: "Suggest accountant or lawyer for statutory matters.",
    severity: "enforced",
  },
];

const PLATFORM_ESCALATION: EscalationRule[] = [
  {
    trigger: "Request is vague or matches multiple records",
    target: "Ask 1–2 clarifying questions — no write tools that turn",
  },
  {
    trigger: "Confidence below 70% or missing packet data",
    target: "Say what is missing and point to the module screen to fix data",
  },
  {
    trigger: "User asks for void/paid/delete or bulk change",
    target: "Confirm explicitly before mutation tools",
  },
  {
    trigger: "Same action fails twice",
    target: "Stop retrying — explain error and suggest manual step in app",
  },
];

function readWriteActions(
  reads: Array<{ key: string; label: string; note?: string }>,
  writes: Array<{ key: string; label: string; note?: string }>,
): AllowedAction[] {
  return [
    ...reads.map((r) => ({ ...r, on: true })),
    ...writes.map((w) => ({
      ...w,
      on: true,
      note: w.note ?? "Requires owner confirmation unless explicit",
    })),
  ];
}

/** Boardroom scope text (no server-only import — safe for seed script). */
const BOARDROOM_SEED_PROMPT = `You are the Boardroom — cross-module executive briefing for ONE Malaysian SME tenant.

STAFF IN THE ROOM: Finance, Operations, Marketing, Sales, HR, Admin — each uses the tenant's display name from Settings (defaults: Fayza, Aiman, Maya, Sufi, Hana, Amir).

RULES:
- Mirror owner language (BM, EN, mixed). JSON only in room — no markdown fences.
- Cite ONLY figures from the DATA PACKET. If empty → say no data and suggest filling records in app.
- Agents debate by name; chair synthesizes one verdict + max 3 priority_actions.
- Valid links: /operations/orders?q=ORD-* · /finance/invoices/{uuid}/edit · /sales/leads · /marketing/customers
- Never invent RM, invoice #, order #, or UUID paths.`;

export const AGENT_SCOPE_SEEDS: AgentScopeSeed[] = [
  {
    slug: "marketing",
    versionLabel: "v1.1.0",
    defaultTone: "Practical marketing colleague — BM/EN",
    systemPrompt: MARKETING_SCOPE_CORE,
    allowedActions: readWriteActions(
      [
        { key: "read_crm", label: "Read CRM & segments" },
        { key: "read_commerce", label: "Read commerce packet (products, sales)" },
        { key: "preview_segment", label: "Preview segment rules" },
      ],
      [
        { key: "create_coupon", label: "Create coupon draft" },
        { key: "create_broadcast", label: "Create broadcast draft" },
        { key: "create_content", label: "Create content calendar draft" },
        { key: "create_segment", label: "Save custom segment" },
        { key: "update_customer_tags", label: "Update customer note/tag" },
      ],
    ),
    guardrails: [
      ...PLATFORM_GUARDRAILS,
      {
        label: "No auto-send WhatsApp/email",
        detail: "Draft only — owner sends from Marketing module.",
        severity: "always",
      },
    ],
    escalation: PLATFORM_ESCALATION,
    knowledgeBase: [
      { label: "Marketing CRM (live)", kind: "Supabase", size: "tenant" },
      { label: "Commerce packet (products + sales)", kind: "Live", size: "tenant" },
      { label: "Coupons & broadcasts", kind: "Module", size: "tenant" },
    ],
  },
  {
    slug: "finance",
    versionLabel: "v1.1.0",
    defaultTone: "Clear finance staff — numbers first",
    systemPrompt: FINANCE_SCOPE_CORE,
    allowedActions: readWriteActions(
      [
        { key: "read_invoices", label: "Read invoices & quotes" },
        { key: "read_ledger", label: "Read ledger & P&L" },
        { key: "read_customers", label: "Read finance customers" },
      ],
      [
        { key: "log_expense", label: "Log expense" },
        { key: "log_income", label: "Log income" },
        { key: "create_invoice", label: "Create invoice/quote" },
        { key: "update_invoice_status", label: "Update invoice status" },
        { key: "send_invoice_email", label: "Send invoice email" },
      ],
    ),
    guardrails: PLATFORM_GUARDRAILS,
    escalation: PLATFORM_ESCALATION,
    knowledgeBase: [
      { label: "Finance invoices & quotes", kind: "Supabase", size: "tenant" },
      { label: "Ledger & cash flow", kind: "Live", size: "tenant" },
      { label: "Customer records", kind: "Module", size: "tenant" },
    ],
  },
  {
    slug: "operations",
    versionLabel: "v1.1.0",
    defaultTone: "Ops-focused — delivery and stock",
    systemPrompt: OPERATIONS_SCOPE_CORE,
    allowedActions: readWriteActions(
      [
        { key: "read_orders", label: "Read orders & bookings" },
        { key: "read_catalog", label: "Read products, services, stock" },
        { key: "today_briefing", label: "Today's ops briefing" },
      ],
      [
        { key: "create_order", label: "Create/update orders" },
        { key: "create_booking", label: "Create/update bookings" },
        { key: "adjust_stock", label: "Adjust stock levels" },
        { key: "catalog_crud", label: "Create/edit products & services" },
      ],
    ),
    guardrails: [
      ...PLATFORM_GUARDRAILS,
      {
        label: "Stay in Operations module",
        detail: "Redirect Finance/HR/Marketing/Sales questions to the right agent.",
        severity: "enforced",
      },
    ],
    escalation: PLATFORM_ESCALATION,
    knowledgeBase: [
      { label: "Orders & fulfilment", kind: "Supabase", size: "tenant" },
      { label: "Products & stock", kind: "Live", size: "tenant" },
      { label: "Bookings & resources", kind: "Module", size: "tenant" },
    ],
  },
  {
    slug: "sales",
    versionLabel: "v1.1.0",
    defaultTone: "Sales floor coach — pipeline first",
    systemPrompt: SALES_SCOPE_CORE,
    allowedActions: readWriteActions(
      [
        { key: "read_leads", label: "Read leads & pipeline" },
        { key: "read_pos", label: "Read today's POS summary" },
      ],
      [
        { key: "create_lead", label: "Create/update leads" },
        { key: "convert_lead", label: "Convert won lead to customer" },
        { key: "draft_chase", label: "Draft chase message (owner sends)" },
      ],
    ),
    guardrails: [
      ...PLATFORM_GUARDRAILS,
      {
        label: "No auto-send chase messages",
        detail: "Draft WhatsApp/SMS copy only.",
        severity: "always",
      },
    ],
    escalation: PLATFORM_ESCALATION,
    knowledgeBase: [
      { label: "Sales leads", kind: "Supabase", size: "tenant" },
      { label: "POS today", kind: "Live", size: "tenant" },
    ],
  },
  {
    slug: "hr",
    versionLabel: "v1.1.0",
    defaultTone: "Supportive HR colleague",
    systemPrompt: HR_SCOPE_CORE,
    allowedActions: readWriteActions(
      [
        { key: "read_team", label: "Read employees & leave calendar" },
        { key: "read_onboarding", label: "Read onboarding checklist" },
      ],
      [
        { key: "record_leave", label: "Record leave" },
        { key: "approve_leave", label: "Approve/reject leave" },
        { key: "onboarding_step", label: "Complete onboarding item" },
      ],
    ),
    guardrails: [
      ...PLATFORM_GUARDRAILS,
      {
        label: "No legal employment advice",
        detail: "HR records only — not labour law opinions.",
        severity: "always",
      },
    ],
    escalation: PLATFORM_ESCALATION,
    knowledgeBase: [
      { label: "HR employees", kind: "Supabase", size: "tenant" },
      { label: "Leave & approvals", kind: "Live", size: "tenant" },
      { label: "Public holidays (MY)", kind: "Feed", size: "national" },
    ],
  },
  {
    slug: "admin",
    versionLabel: "v1.1.0",
    defaultTone: "Organised admin coordinator",
    systemPrompt: ADMIN_SCOPE_CORE,
    allowedActions: readWriteActions(
      [
        { key: "read_tasks", label: "Read admin tasks" },
        { key: "read_compliance", label: "Read compliance renewals" },
        { key: "read_storage", label: "Read document storage index" },
      ],
      [],
    ),
    guardrails: [
      ...PLATFORM_GUARDRAILS,
      {
        label: "Advise-only v1",
        detail: "Do not claim files uploaded or tasks completed — link to /admin/* screens.",
        severity: "enforced",
      },
    ],
    escalation: PLATFORM_ESCALATION,
    knowledgeBase: [
      { label: "Compliance & licences", kind: "Supabase", size: "tenant" },
      { label: "Admin tasks", kind: "Live", size: "tenant" },
      { label: "Storage vault index", kind: "Module", size: "tenant" },
    ],
  },
  {
    slug: "boardroom",
    versionLabel: "v1.1.0",
    defaultTone: "Executive chair — decisive, data-backed",
    systemPrompt: BOARDROOM_SEED_PROMPT,
    allowedActions: [
      { key: "read_all_modules", label: "Read cross-module briefing packets", on: true },
      { key: "agent_speak", label: "Agent speak turns (1 credit each)", on: true },
      { key: "chair_synth", label: "Chair recommendation synthesis", on: true },
      { key: "navigate_links", label: "Valid in-app links on actions", on: true },
      {
        key: "execute_mutations",
        label: "Execute mutations from owner confirm",
        on: false,
        note: "Owner must confirm in meeting",
      },
    ],
    guardrails: [
      ...PLATFORM_GUARDRAILS,
      {
        label: "JSON output only in room",
        detail: "Agents and chair return structured JSON — no markdown fences.",
        severity: "always",
      },
      {
        label: "Valid links only",
        detail: "Use /operations/orders?q=ORD-* pattern — no invented UUID paths.",
        severity: "always",
      },
    ],
    escalation: [
      ...PLATFORM_ESCALATION,
      {
        trigger: "Depth confidence below 80%",
        target: "Pause at checkpoint — owner continues, accepts, or redirects",
      },
    ],
    knowledgeBase: [
      { label: "All module briefing packets", kind: "Live", size: "tenant" },
      { label: "Per-agent domain snapshots", kind: "Supabase", size: "tenant" },
    ],
  },
];

export function agentScopeSeedBySlug(slug: string): AgentScopeSeed | undefined {
  return AGENT_SCOPE_SEEDS.find((s) => s.slug === slug);
}
