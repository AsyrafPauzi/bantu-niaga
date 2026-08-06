import "server-only";

import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_MANUAL_CATEGORIES,
  FINANCE_INVOICE_STATUSES,
  FINANCE_PAYMENT_METHODS,
} from "@/lib/finance/schemas";

export const FINANCE_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_finance_overview",
      description: "MTD income/expense/net, invoice summary counts, outstanding RM.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_invoices",
      description: "List invoices or quotes with optional filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: [...FINANCE_INVOICE_STATUSES] },
          document_kind: { type: "string", enum: ["invoice", "quote"] },
          overdue_only: { type: "boolean" },
          customer_name: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_invoice",
      description: "Get one invoice or quote by number or id.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_transactions",
      description: "List ledger income or expense transactions.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["income", "expense"] },
          month: { type: "string", description: "YYYY-MM" },
          category: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_customers",
      description: "Search billing customers by name, phone, or email.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_pnl_summary",
      description: "Profit & loss summary for a month or date range.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "YYYY-MM" },
          from: { type: "string", description: "YYYY-MM-DD" },
          to: { type: "string", description: "YYYY-MM-DD" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_analytics",
      description: "Income vs expense analytics for a date range.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", enum: [1, 2, 3, 5, 7, 14, 30] },
          from: { type: "string" },
          to: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_chase_list",
      description: "Prioritized list of overdue and outstanding sent invoices.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "month_end_checklist",
      description: "Month-end finance checklist from live data.",
      parameters: {
        type: "object",
        properties: { month: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_chase_message",
      description: "Draft WhatsApp/email chase copy for one invoice (does not send).",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
          tone: { type: "string", enum: ["friendly", "firm"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_pay_link",
      description: "Public pay link for an invoice.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_income",
      description: "Log manual income in the ledger.",
      parameters: {
        type: "object",
        properties: {
          amount_myr: { type: "number" },
          description: { type: "string" },
          category: { type: "string", enum: [...FINANCE_INCOME_MANUAL_CATEGORIES] },
          counterparty: { type: "string" },
          payment_method: { type: "string", enum: [...FINANCE_PAYMENT_METHODS] },
          txn_date: { type: "string" },
        },
        required: ["amount_myr", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_expense",
      description: "Log an expense in the ledger.",
      parameters: {
        type: "object",
        properties: {
          amount_myr: { type: "number" },
          description: { type: "string" },
          category: { type: "string", enum: [...FINANCE_EXPENSE_CATEGORIES] },
          counterparty: { type: "string" },
          payment_method: { type: "string", enum: [...FINANCE_PAYMENT_METHODS] },
          txn_date: { type: "string" },
        },
        required: ["amount_myr", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_customer",
      description: "Save a billing customer for invoices.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_customer",
      description: "Update a customer by name or id.",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string" },
          customer_name: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_invoice",
      description:
        "Create an invoice or quote. Provide customer + amount or line description.",
      parameters: {
        type: "object",
        properties: {
          document_kind: { type: "string", enum: ["invoice", "quote"] },
          customer_id: { type: "string" },
          customer_name: { type: "string" },
          customer_email: { type: "string" },
          customer_phone: { type: "string" },
          amount_myr: { type: "number" },
          description: { type: "string", description: "Line item / title" },
          title: { type: "string" },
          due_date: { type: "string" },
          status: { type: "string", enum: ["draft", "sent"] },
          notes: { type: "string" },
        },
        required: ["amount_myr"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_invoice_status",
      description: "Mark invoice sent, paid, or void. User must confirm void/paid.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
          status: { type: "string", enum: ["draft", "sent", "paid", "void"] },
          user_confirmed: {
            type: "boolean",
            description: "True only after user explicitly confirmed void or paid.",
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "convert_quote_to_invoice",
      description: "Convert a quote to a draft invoice.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
          due_date: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_invoice_email",
      description: "Email invoice PDF to customer. Requires customer email.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          invoice_number: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

const ACTION_TOOLS = new Set([
  "log_income",
  "log_expense",
  "create_customer",
  "update_customer",
  "create_invoice",
  "update_invoice_status",
  "convert_quote_to_invoice",
  "send_invoice_email",
]);

export function isFinanceActionTool(name: string): boolean {
  return ACTION_TOOLS.has(name);
}
