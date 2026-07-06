/**
 * Catalog of platform-wide API integrations.
 *
 * Everything in this file is compile-time metadata: field schema, copy,
 * docs URLs, and a flag indicating whether the rest of the app actually
 * consumes the integration today. The platform-admin UI renders this
 * catalog as cards and lets an admin save credentials into
 * `public.platform_integrations`.
 *
 * Adding a new integration:
 *   1. Append a new IntegrationDescriptor below.
 *   2. If you have a consumer file (e.g. `lib/ai/openai.ts`), set
 *      `wired: true`. Otherwise leave it `false` — the UI will show a
 *      "Not yet wired" pill so the team knows credentials are stored
 *      but no code reads them yet.
 *   3. If the integration introduces a new category, add it to
 *      IntegrationCategory in types.ts and CATEGORY_META below.
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
    description:
      "Models that power Maya, Finance, Operations, Boardroom agents.",
    emoji: "✨",
  },
  payments: {
    label: "Payments",
    description: "Local and international payment gateways.",
    emoji: "💳",
  },
  communication: {
    label: "Communication",
    description: "WhatsApp, SMS, transactional + marketing email.",
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
    description: "Track usage, funnels, retention, and error trends.",
    emoji: "📈",
  },
  storage: {
    label: "Storage & CDN",
    description: "External object storage beyond Supabase defaults.",
    emoji: "🗄️",
  },
};

export const INTEGRATION_CATALOG: readonly IntegrationDescriptor[] = [
  // ── AI ───────────────────────────────────────────────────────────────
  {
    slug: "openai",
    name: "OpenAI",
    category: "ai",
    tagline: "GPT-4o + embeddings for every AI agent",
    description:
      "Powers the Maya, Finance, Operations, and Boardroom agents plus all embeddings + AI tag scoring used in Marketing CRM. Required for the AI agents to function.",
    docsUrl: "https://platform.openai.com/docs",
    capabilities: [
      "Chat completions (Maya / Finance / Ops / Boardroom)",
      "Embeddings (semantic search, dedup, auto-tags)",
      "Function calling for structured outputs",
    ],
    fields: [
      {
        key: "api_key",
        label: "API key",
        type: "secret",
        required: true,
        helper: "Generate at platform.openai.com/api-keys (starts with sk-…).",
      },
      {
        key: "organization_id",
        label: "Organization ID",
        type: "text",
        required: false,
        placeholder: "org-…",
        helper: "Optional — only required if your key belongs to multiple orgs.",
      },
      {
        key: "default_model",
        label: "Default chat model",
        type: "text",
        required: false,
        placeholder: "gpt-4o-mini",
        helper: "Used as the system-wide default when no per-agent override is set.",
      },
    ],
    wired: true,
    importance: "core",
  },
  {
    slug: "ilmu",
    name: "ILMU (YTL AI Labs)",
    category: "ai",
    tagline: "Malaysian LLM — ILMU Mini v3.3 for HR and agents",
    description:
      "Preferred AI provider for Bantu Niaga. OpenAI-compatible API at api.ilmu.ai. When configured, all chat agents (including the HR Assistant) use ILMU instead of OpenAI.",
    docsUrl: "https://docs.ilmu.ai",
    capabilities: [
      "Chat completions (OpenAI-compatible)",
      "ILMU Mini v3.3 — cost-efficient SME workloads",
      "Tenant-scoped HR Assistant",
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
        helper: "Recommended: ilmu-mini-v3.3 for HR Q&A.",
      },
      {
        key: "base_url",
        label: "API base URL",
        type: "text",
        required: false,
        placeholder: "https://api.ilmu.ai/v1",
        helper: "Leave blank to use the default ILMU endpoint.",
      },
    ],
    wired: true,
    importance: "core",
  },
  {
    slug: "anthropic",
    name: "Anthropic Claude",
    category: "ai",
    tagline: "Fallback / alternative LLM provider",
    description:
      "Optional secondary LLM. When configured, the Boardroom agent can route long-context analyses to Claude when OpenAI rate-limits or fails.",
    docsUrl: "https://docs.anthropic.com",
    capabilities: [
      "Backup chat completions",
      "Long-context summarisation (200k tokens)",
    ],
    fields: [
      { key: "api_key", label: "API key", type: "secret", required: true },
      {
        key: "default_model",
        label: "Default model",
        type: "text",
        required: false,
        placeholder: "claude-opus-4",
      },
    ],
    wired: false,
    importance: "optional",
  },
  {
    slug: "google-gemini",
    name: "Google Gemini",
    category: "ai",
    tagline: "Vertex AI Gemini for multimodal tasks",
    description:
      "Useful for image / video understanding (e.g. receipt OCR, ID-card extraction). Optional today.",
    docsUrl: "https://ai.google.dev/docs",
    capabilities: ["Multimodal vision + text", "Document OCR", "Translation"],
    fields: [
      { key: "api_key", label: "API key", type: "secret", required: true },
      {
        key: "project_id",
        label: "Google Cloud project ID",
        type: "text",
        required: false,
      },
    ],
    wired: false,
    importance: "optional",
  },
  {
    slug: "replicate",
    name: "Replicate",
    category: "ai",
    tagline: "Open-source image / video generation",
    description:
      "On-demand inference for OSS models (Stable Diffusion, SDXL, Flux). Wire into Marketing → Content media generator.",
    docsUrl: "https://replicate.com/docs",
    capabilities: ["Image generation", "Video generation", "Custom fine-tunes"],
    fields: [
      { key: "api_token", label: "API token", type: "secret", required: true },
    ],
    wired: false,
    importance: "optional",
  },

  // ── Payments ─────────────────────────────────────────────────────────
  {
    slug: "billplz",
    name: "Billplz",
    category: "payments",
    tagline: "FPX + DuitNow + cards for Malaysian SMEs",
    description:
      "The most popular local payment gateway. Powers customer-facing invoice payments, marketplace add-on purchases, and credit top-ups.",
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
    slug: "ipay88",
    name: "iPay88",
    category: "payments",
    tagline: "Traditional Malaysian merchant gateway",
    description:
      "Alternative to Billplz. Useful for larger SMEs with existing iPay88 merchant accounts and acquirer relationships.",
    docsUrl: "https://www.ipay88.com/integration",
    capabilities: ["FPX", "Card payments", "Mobile wallets"],
    fields: [
      { key: "merchant_code", label: "Merchant code", type: "text", required: true },
      { key: "merchant_key", label: "Merchant key", type: "secret", required: true },
      {
        key: "sandbox",
        label: "Use sandbox endpoint",
        type: "bool",
        required: false,
      },
    ],
    wired: false,
    importance: "recommended",
  },
  {
    slug: "stripe",
    name: "Stripe",
    category: "payments",
    tagline: "International cards + subscriptions",
    description:
      "Use Stripe for cross-border customers, Stripe Tax, and subscription billing. Recommended once you have international or recurring customers.",
    docsUrl: "https://stripe.com/docs/api",
    capabilities: [
      "Card payments (international)",
      "Subscriptions + invoicing",
      "Apple Pay / Google Pay",
      "Stripe Tax",
    ],
    fields: [
      { key: "secret_key", label: "Secret key", type: "secret", required: true },
      {
        key: "publishable_key",
        label: "Publishable key",
        type: "text",
        required: true,
      },
      {
        key: "webhook_secret",
        label: "Webhook signing secret",
        type: "secret",
        required: false,
      },
    ],
    wired: false,
    importance: "recommended",
  },

  // ── Communication ────────────────────────────────────────────────────
  {
    slug: "whatsapp-cloud",
    name: "WhatsApp Business (Cloud API)",
    category: "communication",
    tagline: "Send invoices, receipts, reminders via WhatsApp",
    description:
      "The most important channel for Malaysian SMEs. Once configured, every invoice / booking / leave form can be delivered as a WhatsApp message instead of email.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    capabilities: [
      "Send templated messages",
      "Two-way conversations",
      "Receive customer messages (webhooks)",
      "Media attachments (PDF invoices, receipts)",
    ],
    fields: [
      {
        key: "phone_number_id",
        label: "Phone number ID",
        type: "text",
        required: true,
      },
      {
        key: "business_account_id",
        label: "WABA ID",
        type: "text",
        required: true,
      },
      {
        key: "access_token",
        label: "Permanent access token",
        type: "secret",
        required: true,
      },
      {
        key: "webhook_verify_token",
        label: "Webhook verify token",
        type: "secret",
        required: true,
        helper: "Pick any random string; configure the same value in Meta dashboard.",
      },
    ],
    wired: false,
    importance: "core",
  },
  {
    slug: "twilio",
    name: "Twilio",
    category: "communication",
    tagline: "SMS fallback for OTP + alerts",
    description:
      "Used as an SMS fallback when WhatsApp is not available (e.g. cold leads, brand-new bookings). Also handles OTP delivery for two-factor auth.",
    docsUrl: "https://www.twilio.com/docs",
    capabilities: ["SMS", "WhatsApp (legacy)", "Voice / IVR (advanced)"],
    fields: [
      { key: "account_sid", label: "Account SID", type: "text", required: true },
      { key: "auth_token", label: "Auth token", type: "secret", required: true },
      {
        key: "from_number",
        label: "From number (E.164)",
        type: "text",
        required: true,
        placeholder: "+15551234567",
      },
    ],
    wired: false,
    importance: "recommended",
  },
  {
    slug: "resend",
    name: "Resend",
    category: "communication",
    tagline: "Transactional email (sign-up, invoices, receipts)",
    description:
      "Best-in-class developer experience for transactional email. Replaces the Supabase default email provider once you exceed the free tier.",
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

  // ── Social media ─────────────────────────────────────────────────────
  {
    slug: "meta-graph",
    name: "Meta (Facebook + Instagram)",
    category: "social",
    tagline: "Publish posts + read insights on FB Pages and IG Business",
    description:
      "The Meta Graph API integration is already wired into the Marketing → Content publisher and the per-post insights drawer. Configure the app ID and secret here (or via env).",
    docsUrl: "https://developers.facebook.com/docs/graph-api",
    capabilities: [
      "Page + IG OAuth (per-tenant)",
      "Publish posts + photos",
      "Read post insights",
    ],
    fields: [
      { key: "app_id", label: "Meta App ID", type: "text", required: true },
      { key: "app_secret", label: "App secret", type: "secret", required: true },
      {
        key: "redirect_uri",
        label: "OAuth redirect URI",
        type: "url",
        required: false,
        helper:
          "Defaults to NEXT_PUBLIC_APP_URL + /api/social/meta/callback when blank.",
      },
    ],
    wired: true,
    importance: "core",
  },
  {
    slug: "tiktok-business",
    name: "TikTok Business",
    category: "social",
    tagline: "Schedule + read insights from TikTok posts",
    description:
      "Adds TikTok as a publishable channel alongside Facebook + Instagram. Wire-up is identical to Meta — OAuth on the tenant side, content publish API on the server.",
    docsUrl: "https://business-api.tiktok.com",
    capabilities: ["OAuth", "Publish videos", "Post insights"],
    fields: [
      { key: "app_id", label: "App ID", type: "text", required: true },
      { key: "app_secret", label: "App secret", type: "secret", required: true },
    ],
    wired: false,
    importance: "recommended",
  },
  {
    slug: "youtube",
    name: "YouTube Data API",
    category: "social",
    tagline: "Schedule uploads + manage channel content",
    description:
      "Lets the Marketing module schedule YouTube uploads and read view counts. Useful once Boardroom starts reporting on long-form video performance.",
    docsUrl: "https://developers.google.com/youtube/v3",
    capabilities: ["Video upload", "Channel insights", "Comment moderation"],
    fields: [
      { key: "client_id", label: "OAuth client ID", type: "text", required: true },
      {
        key: "client_secret",
        label: "OAuth client secret",
        type: "secret",
        required: true,
      },
      { key: "api_key", label: "API key", type: "secret", required: false },
    ],
    wired: false,
    importance: "optional",
  },

  // ── Maps ─────────────────────────────────────────────────────────────
  {
    slug: "google-maps",
    name: "Google Maps Platform",
    category: "maps",
    tagline: "Address autocomplete + geocoding",
    description:
      "Powers the address picker on /sign-up, customer creation, and the delivery-radius calculator used in Operations.",
    docsUrl: "https://developers.google.com/maps/documentation",
    capabilities: [
      "Places autocomplete",
      "Geocoding (postcode → coordinates)",
      "Distance matrix (delivery quotes)",
    ],
    fields: [
      { key: "api_key", label: "API key", type: "secret", required: true },
      {
        key: "default_region",
        label: "Default region",
        type: "text",
        required: false,
        placeholder: "MY",
      },
    ],
    wired: false,
    importance: "recommended",
  },

  // ── LHDN MyInvois (Malaysia e-invoicing — mandatory from 2026) ───────
  {
    slug: "lhdn-myinvois",
    name: "LHDN MyInvois",
    category: "einvoicing",
    tagline: "Mandatory Malaysian e-invoicing portal",
    description:
      "Submit every invoice to LHDN's MyInvois portal as required by the Income Tax (Amendment) Act 2024. Without this configured, businesses above the SST threshold are non-compliant.",
    docsUrl: "https://mytax.hasil.gov.my/MyInvois",
    capabilities: [
      "Submit invoices in real-time",
      "Fetch validation status",
      "Cancel invoices within 72-hour window",
    ],
    fields: [
      {
        key: "client_id",
        label: "Client ID",
        type: "text",
        required: true,
        helper: "Obtain via MyInvois sandbox / production registration.",
      },
      {
        key: "client_secret",
        label: "Client secret",
        type: "secret",
        required: true,
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        required: true,
        options: [
          { value: "sandbox", label: "Sandbox (api.preprod.myinvois.hasil.gov.my)" },
          { value: "production", label: "Production (api.myinvois.hasil.gov.my)" },
        ],
      },
    ],
    wired: false,
    importance: "core",
  },

  // ── Accounting ───────────────────────────────────────────────────────
  {
    slug: "xero",
    name: "Xero",
    category: "accounting",
    tagline: "Two-way sync with Xero",
    description:
      "Optional. When connected, Finance invoices and expenses sync to Xero so accountants can keep using their preferred ledger.",
    docsUrl: "https://developer.xero.com/documentation",
    capabilities: ["Invoice sync", "Bill sync", "Contacts sync", "Bank reconciliation"],
    fields: [
      { key: "client_id", label: "OAuth client ID", type: "text", required: true },
      {
        key: "client_secret",
        label: "OAuth client secret",
        type: "secret",
        required: true,
      },
    ],
    wired: false,
    importance: "optional",
  },
  {
    slug: "quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    tagline: "Two-way sync with QuickBooks Online",
    description:
      "Equivalent to Xero — for tenants whose accountants prefer QBO. Lower priority than Xero in the Malaysian market.",
    docsUrl: "https://developer.intuit.com/app/developer/qbo",
    capabilities: ["Invoice sync", "Customer sync", "P&L export"],
    fields: [
      { key: "client_id", label: "OAuth client ID", type: "text", required: true },
      {
        key: "client_secret",
        label: "OAuth client secret",
        type: "secret",
        required: true,
      },
    ],
    wired: false,
    importance: "optional",
  },

  // ── Logistics ────────────────────────────────────────────────────────
  {
    slug: "lalamove",
    name: "Lalamove",
    category: "logistics",
    tagline: "On-demand same-day courier",
    description:
      "Used by Operations → Orders to dispatch deliveries on demand. Returns live tracking URLs the customer can share.",
    docsUrl: "https://developers.lalamove.com",
    capabilities: ["Quote", "Place order", "Track driver", "Webhook delivery events"],
    fields: [
      { key: "api_key", label: "API key", type: "secret", required: true },
      { key: "api_secret", label: "API secret", type: "secret", required: true },
      {
        key: "market",
        label: "Market",
        type: "select",
        required: true,
        options: [
          { value: "MY_KUL", label: "Malaysia — Kuala Lumpur" },
          { value: "MY_JHB", label: "Malaysia — Johor Bahru" },
          { value: "MY_PEN", label: "Malaysia — Penang" },
        ],
      },
    ],
    wired: false,
    importance: "recommended",
  },
  {
    slug: "easyparcel",
    name: "EasyParcel",
    category: "logistics",
    tagline: "Multi-courier shipping aggregator",
    description:
      "Pos Laju, J&T, GDex, City-Link, Ninjavan — all behind one API. Best for tenants that ship within Malaysia.",
    docsUrl: "https://easyparcel.com/my/en/api",
    capabilities: ["Rate quote", "Book shipment", "Print label", "Track parcel"],
    fields: [
      { key: "api_key", label: "API key", type: "secret", required: true },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        required: true,
        options: [
          { value: "sandbox", label: "Sandbox" },
          { value: "production", label: "Production" },
        ],
      },
    ],
    wired: false,
    importance: "recommended",
  },

  // ── Analytics ────────────────────────────────────────────────────────
  {
    slug: "posthog",
    name: "PostHog",
    category: "analytics",
    tagline: "Product analytics + session replay",
    description:
      "Tracks feature adoption, retention, and funnel drop-offs. Recommended once you have 50+ active tenants so the data is statistically meaningful.",
    docsUrl: "https://posthog.com/docs",
    capabilities: ["Events", "Funnels", "Cohorts", "Session replay (opt-in)"],
    fields: [
      { key: "project_api_key", label: "Project API key", type: "text", required: true },
      {
        key: "host",
        label: "Self-hosted host (optional)",
        type: "url",
        required: false,
        placeholder: "https://app.posthog.com",
      },
    ],
    wired: false,
    importance: "recommended",
  },
  {
    slug: "google-analytics",
    name: "Google Analytics 4",
    category: "analytics",
    tagline: "Standard product analytics",
    description:
      "Free industry-standard analytics. Useful for the public marketing site; less so for the authenticated app (use PostHog there).",
    docsUrl: "https://developers.google.com/analytics",
    capabilities: ["Page views", "Conversions", "Audience analytics"],
    fields: [
      { key: "measurement_id", label: "Measurement ID", type: "text", required: true, placeholder: "G-XXXXXXX" },
      { key: "api_secret", label: "Measurement Protocol API secret", type: "secret", required: false },
    ],
    wired: false,
    importance: "optional",
  },

  // ── Storage ──────────────────────────────────────────────────────────
  {
    slug: "cloudflare-r2",
    name: "Cloudflare R2",
    category: "storage",
    tagline: "S3-compatible storage with zero egress fees",
    description:
      "Optional storage backend for tenant uploads. Significantly cheaper than S3 once you exceed Supabase Storage's bundled quota.",
    docsUrl: "https://developers.cloudflare.com/r2",
    capabilities: ["Object storage", "S3-compatible API", "Zero egress fees"],
    fields: [
      { key: "account_id", label: "Account ID", type: "text", required: true },
      { key: "access_key_id", label: "Access key ID", type: "text", required: true },
      { key: "secret_access_key", label: "Secret access key", type: "secret", required: true },
      { key: "bucket", label: "Bucket name", type: "text", required: true },
    ],
    wired: false,
    importance: "optional",
  },
];

export function findIntegration(slug: string) {
  return INTEGRATION_CATALOG.find((i) => i.slug === slug);
}
