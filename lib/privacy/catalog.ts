import type { ConsentKind } from "./types";

/**
 * Catalog of consent kinds shown to the user in /settings/privacy.
 *
 * Two are *required* (terms_of_service, privacy_notice) — the user cannot
 * withdraw them without closing their account. The remaining four are
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
      "Important product news, security advisories, and module releases.",
    required: false,
    defaultGranted: true,
  },
  {
    kind: "ai_training",
    title: "AI assistant improvements",
    description:
      "Allow anonymised usage samples to improve Hana and other AI assistants. Raw business records are never shared.",
    required: false,
    defaultGranted: false,
  },
  {
    kind: "analytics",
    title: "Product analytics",
    description:
      "Helps us understand which features are used so we can improve the platform. Aggregated only.",
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
    category: "Payment & billing data",
    retention: "7 years.",
    legalBasis: "Tax & accounting law",
  },
  {
    category: "Generated export bundles",
    retention: "7 days from creation.",
    legalBasis: "Operational — short-lived cache",
  },
];

export const ACCOUNT_DELETION_GRACE_DAYS = 30 as const;
