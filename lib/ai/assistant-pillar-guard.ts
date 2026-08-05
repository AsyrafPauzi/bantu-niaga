/**
 * Runtime scope guard — block cross-pillar assistant chats before LLM spend.
 */

export interface AssistantPillarRedirect {
  pillar: string;
  agentName: string;
  chatHref: string;
}

const OPERATIONS_IN_SCOPE =
  /\b(operations?|aiman|stock|inventory|low[\s-]?stock|restock|booking|bookings|appointment|supplier|suppliers|vendor|product|products|sku|catalog|catalogue|service menu|fulfillment|pickup|delivery|order board|orders?|resource|walk[\s-]?in|warehouse)\b/i;

const OTHER_PILLAR_RULES: Array<{
  redirect: AssistantPillarRedirect;
  patterns: RegExp[];
}> = [
  {
    redirect: {
      pillar: "Finance",
      agentName: "Fayza",
      chatHref: "/finance/assistant",
    },
    patterns: [
      /\b(invoice|invoices|quotation|quotations)\b/i,
      /\b(expense|expenses|p&l|profit.and.loss)\b/i,
      /\b(cash[\s-]?flow|ledger|billplz|chase (payment|invoice))\b/i,
      /\bfayza\b/i,
      /\b(gst|sst|tax (filing|return))\b/i,
      /\b(bank reconciliation|month[\s-]?end close)\b/i,
    ],
  },
  {
    redirect: {
      pillar: "HR",
      agentName: "Hana",
      chatHref: "/hr/assistant",
    },
    patterns: [
      /\b(leave request|on leave|mc letter|medical certificate|payroll|payslip|payslips)\b/i,
      /\b(hana)\b/i,
      /\b(staff attendance|annual leave|unpaid leave)\b/i,
      /\b(employee appraisal|performance review)\b/i,
    ],
  },
  {
    redirect: {
      pillar: "Marketing",
      agentName: "Maya",
      chatHref: "/marketing?maya=open",
    },
    patterns: [
      /\b(coupon|coupons|broadcast|broadcasts)\b/i,
      /\b(maya)\b/i,
      /\b(marketing campaign|instagram caption|social media post)\b/i,
      /\b(crm segment|customer segment|vip segment)\b/i,
    ],
  },
  {
    redirect: {
      pillar: "Sales",
      agentName: "Sufi",
      chatHref: "/sales/assistant",
    },
    patterns: [
      /\b(sales lead|sales leads|lead pipeline)\b/i,
      /\b(sufi)\b/i,
      /\b(pos sale|point of sale|convert lead)\b/i,
      /\b(chase lead|follow up lead)\b/i,
    ],
  },
  {
    redirect: {
      pillar: "Admin",
      agentName: "Amir",
      chatHref: "/admin/assistant",
    },
    patterns: [
      /\b(compliance renewal|license renewal)\b/i,
      /\b(amir)\b/i,
      /\b(admin task|company secretary|ssm filing)\b/i,
    ],
  },
];

export function detectOperationsAssistantOutOfScope(
  message: string,
): AssistantPillarRedirect | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (OPERATIONS_IN_SCOPE.test(trimmed)) {
    return null;
  }

  for (const rule of OTHER_PILLAR_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return rule.redirect;
    }
  }

  return null;
}

export function buildOperationsOutOfScopeReply(
  displayName: string,
  redirect: AssistantPillarRedirect,
): string {
  return (
    `I'm **${displayName}** — I only handle **Operations** for this business ` +
    `(products, stock, orders, bookings, suppliers).\n\n` +
    `For **${redirect.pillar}** questions, please chat with **${redirect.agentName}** instead:\n` +
    `[Open ${redirect.agentName} →](${redirect.chatHref})\n\n` +
    `If you meant something in Operations (e.g. an order or booking), rephrase and I'll help.`
  );
}
