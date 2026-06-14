import type { ConsentKind } from "./types";

/**
 * Catalog of consent kinds shown to the user in /settings/privacy.
 *
 * Two are *required* (terms_of_service, privacy_notice) — the user cannot
 * withdraw them without closing their account. The remaining five are
 * opt-in/opt-out and can be toggled freely.
 *
 * Keeping the copy here (not in the database) lets us version-control the
 * exact wording the user saw, which is important for PDPA s.6 (consent
 * must be specific and informed).
 */

export interface ConsentDescriptor {
  kind: ConsentKind;
  title: string;
  description: string;
  required: boolean;
  defaultGranted: boolean;
}

export const CONSENT_CATALOG: readonly ConsentDescriptor[] = [
  {
    kind: "terms_of_service",
    title: "Terms of Service",
    description:
      "The baseline agreement that lets you use Bantu Niaga. Required to keep your account active.",
    required: true,
    defaultGranted: true,
  },
  {
    kind: "privacy_notice",
    title: "Privacy Notice (PDPA)",
    description:
      "Confirms you've read how we collect, use, and retain your business data under Malaysia's PDPA 2010.",
    required: true,
    defaultGranted: true,
  },
  {
    kind: "marketing_email",
    title: "Marketing emails",
    description:
      "Promotional offers, plan discounts, and new-feature announcements. You can unsubscribe any time.",
    required: false,
    defaultGranted: false,
  },
  {
    kind: "product_updates",
    title: "Product updates",
    description:
      "Monthly newsletter covering new modules, AI agent improvements, and security advisories.",
    required: false,
    defaultGranted: true,
  },
  {
    kind: "ai_training",
    title: "Improve our AI agents",
    description:
      "Allow Bantu Niaga to use anonymised samples of your data to fine-tune Maya / Finance / Operations / Boardroom. We never share raw business data.",
    required: false,
    defaultGranted: false,
  },
  {
    kind: "analytics",
    title: "Product analytics",
    description:
      "Lets us understand which features are useful so we can invest in the right places. Aggregated; no individual session is identifiable.",
    required: false,
    defaultGranted: true,
  },
  {
    kind: "third_party_share",
    title: "Third-party sharing",
    description:
      "Share strictly-necessary data with sub-processors (payment gateways, transactional email, AI providers). Withdrawing this disables most of the platform.",
    required: false,
    defaultGranted: true,
  },
];

/**
 * Retention schedule published in the privacy notice. The values are
 * intentionally conservative — adjust per your data-controller policy.
 */
export const RETENTION_SCHEDULE: readonly {
  category: string;
  retention: string;
  legalBasis: string;
}[] = [
  {
    category: "Account profile (name, email, phone, role)",
    retention: "Lifetime of the account, then 30 days after deletion request.",
    legalBasis: "Contract (PDPA s.6(1)(a))",
  },
  {
    category: "Business records (invoices, payroll, customer ledger)",
    retention: "7 years from creation.",
    legalBasis: "Companies Act 1965 & Income Tax Act 1967",
  },
  {
    category: "Audit log",
    retention: "7 years.",
    legalBasis: "PDPA s.7 — security & integrity",
  },
  {
    category: "AI conversation history",
    retention: "12 months unless you opt out of AI training.",
    legalBasis: "Legitimate interest (PDPA s.6(2))",
  },
  {
    category: "Payment & billing data",
    retention: "7 years.",
    legalBasis: "Tax & accounting law",
  },
  {
    category: "Marketing engagement (opens, clicks)",
    retention: "24 months from last interaction.",
    legalBasis: "Consent (PDPA s.6(1)(b))",
  },
  {
    category: "Generated export bundles",
    retention: "7 days from creation.",
    legalBasis: "Operational — short-lived cache",
  },
];

export const ACCOUNT_DELETION_GRACE_DAYS = 30 as const;
