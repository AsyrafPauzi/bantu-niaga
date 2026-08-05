/**
 * Catalog of platform-wide API integrations.
 *
 * Only integrations Bantu Niaga actively uses or plans to wire are listed
 * Platform service credentials are configured via production `.env` (ILMU,
 * Billplz, Resend, GA4, Cloudflare R2). The catalog below documents
 * supported services; legacy rows may exist in `public.platform_integrations`.
 */

import type {
  IntegrationCategory,
  IntegrationDescriptor,
} from "./types";

export const CATEGORY_META: Record<
  IntegrationCategory,
  { label: string; description: string; emoji: string }
> = {
  ai: {
    label: "AI & ML",
    description: "ILMU models for tenant AI agents and assistants.",
    emoji: "✨",
  },
  payments: {
    label: "Payments",
    description: "Local payment gateway for invoices and top-ups.",
    emoji: "💳",
  },
  communication: {
    label: "Communication",
    description: "Transactional email.",
    emoji: "💬",
  },
  social: {
    label: "Social media",
    description: "Publish and read analytics from social channels.",
    emoji: "📣",
  },
  maps: {
    label: "Maps & location",
    description: "Geocoding, address autocomplete, delivery distance.",
    emoji: "🗺️",
  },
  einvoicing: {
    label: "E-Invoicing",
    description: "LHDN MyInvois and other regulated invoicing networks.",
    emoji: "🧾",
  },
  accounting: {
    label: "Accounting sync",
    description: "Push invoices, expenses, payroll into external books.",
    emoji: "📚",
  },
  logistics: {
    label: "Logistics & delivery",
    description: "Same-day couriers, parcel shipping, label printing.",
    emoji: "🚚",
  },
  analytics: {
    label: "Product analytics",
    description: "Track usage on the marketing site.",
    emoji: "📈",
  },
  storage: {
    label: "Storage & CDN",
    description: "External object storage beyond Supabase defaults.",
    emoji: "🗄️",
  },
};

export const INTEGRATION_CATALOG: readonly IntegrationDescriptor[] = [
  {
    slug: "ilmu",
    name: "ILMU (YTL AI Labs)",
    category: "ai",
    tagline: "Malaysian LLM — ILMU Mini v3.3 for all AI agents",
    description:
      "Platform-wide AI provider. One ILMU key powers all tenants; each business chat is isolated by business_id.",
    docsUrl: "https://docs.ilmu.ai",
    capabilities: [
      "Chat completions (OpenAI-compatible)",
      "ILMU Mini v3.3 — cost-efficient SME workloads",
      "Tenant-scoped assistants and Boardroom",
    ],
    fields: [
      {
        key: "api_key",
        label: "API key",
        type: "secret",
        required: true,
        helper: "Generate in the ILMU Console (starts with sk-…).",
      },
      {
        key: "default_model",
        label: "Default chat model",
        type: "text",
        required: false,
        placeholder: "ilmu-mini-v3.3",
      },
      {
        key: "base_url",
        label: "API base URL",
        type: "text",
        required: false,
        placeholder: "https://api.ilmu.ai/v1",
      },
    ],
    wired: true,
    importance: "core",
  },
  {
    slug: "replicate",
    name: "Replicate",
    category: "ai",
    tagline: "Open-source image / video generation",
    description:
      "On-demand inference for OSS models. Planned for Marketing content media generation.",
    docsUrl: "https://replicate.com/docs",
    capabilities: ["Image generation", "Video generation", "Custom fine-tunes"],
    fields: [
      { key: "api_token", label: "API token", type: "secret", required: true },
    ],
    wired: false,
    importance: "optional",
  },
  {
    slug: "billplz",
    name: "Billplz",
    category: "payments",
    tagline: "FPX + DuitNow + cards for Malaysian SMEs",
    description:
      "Local payment gateway for invoice payments, marketplace add-ons, and credit top-ups.",
    docsUrl: "https://www.billplz.com/api",
    capabilities: [
      "FPX bank transfer",
      "DuitNow QR + Online Banking",
      "Credit / debit cards",
      "Webhook-based payment confirmations",
    ],
    fields: [
      { key: "api_key", label: "API secret key", type: "secret", required: true },
      {
        key: "x_signature_key",
        label: "X-Signature key",
        type: "secret",
        required: true,
        helper:
          "Used to verify webhook authenticity. Set in Billplz dashboard → Account → X-Signature.",
      },
      {
        key: "collection_id",
        label: "Collection ID",
        type: "text",
        required: true,
        placeholder: "abc-defg-hijk",
      },
      {
        key: "sandbox",
        label: "Use sandbox endpoint",
        type: "bool",
        required: false,
      },
    ],
    wired: false,
    importance: "core",
  },
  {
    slug: "resend",
    name: "Resend",
    category: "communication",
    tagline: "Transactional email (sign-up, invoices, receipts)",
    description:
      "Transactional email for sign-up, invoices, and marketing broadcasts.",
    docsUrl: "https://resend.com/docs",
    capabilities: [
      "Transactional email",
      "Domain authentication (SPF + DKIM)",
      "React email templates",
    ],
    fields: [
      { key: "api_key", label: "API key", type: "secret", required: true },
      {
        key: "from_address",
        label: "Default From address",
        type: "text",
        required: true,
        placeholder: "no-reply@bantuniaga.com",
      },
    ],
    wired: false,
    importance: "core",
  },
  {
    slug: "google-analytics",
    name: "Google Analytics 4",
    category: "analytics",
    tagline: "Marketing site analytics",
    description: "Page views and conversions on the public marketing site.",
    docsUrl: "https://developers.google.com/analytics",
    capabilities: ["Page views", "Conversions", "Audience analytics"],
    fields: [
      {
        key: "measurement_id",
        label: "Measurement ID",
        type: "text",
        required: true,
        placeholder: "G-XXXXXXX",
      },
      {
        key: "api_secret",
        label: "Measurement Protocol API secret",
        type: "secret",
        required: false,
      },
    ],
    wired: false,
    importance: "optional",
  },
  {
    slug: "cloudflare-r2",
    name: "Cloudflare R2",
    category: "storage",
    tagline: "S3-compatible storage with zero egress fees",
    description:
      "Optional storage backend for tenant uploads beyond Supabase Storage quota.",
    docsUrl: "https://developers.cloudflare.com/r2",
    capabilities: ["Object storage", "S3-compatible API", "Zero egress fees"],
    fields: [
      { key: "account_id", label: "Account ID", type: "text", required: true },
      { key: "access_key_id", label: "Access key ID", type: "text", required: true },
      {
        key: "secret_access_key",
        label: "Secret access key",
        type: "secret",
        required: true,
      },
      { key: "bucket", label: "Bucket name", type: "text", required: true },
    ],
    wired: false,
    importance: "optional",
  },
];

export function findIntegration(slug: string) {
  return INTEGRATION_CATALOG.find((i) => i.slug === slug);
}

/** Categories that have at least one catalog entry (for admin filters). */
export function integrationCategoriesInCatalog(): Array<{
  value: IntegrationCategory;
  label: string;
}> {
  const seen = new Set<IntegrationCategory>();
  for (const item of INTEGRATION_CATALOG) {
    seen.add(item.category);
  }
  return [...seen].map((value) => ({
    value,
    label: CATEGORY_META[value].label,
  }));
}
