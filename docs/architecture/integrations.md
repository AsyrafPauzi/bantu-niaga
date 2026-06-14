# Platform integrations

Bantu Niaga ships with a built-in registry of third-party API integrations
managed by the platform admin from `/super-admin/integrations`. Each
integration is described in the **catalog** (compile-time metadata) and
its run-time state is stored in **`platform_integrations`** (one row per
slug).

## Why this exists

Before this subsystem, every integration had its own env var pattern
(`OPENAI_API_KEY`, `META_APP_SECRET`, …). That works for one or two
integrations but breaks down once you have a dozen — you can't rotate
keys without a redeploy, you can't see at a glance which are configured,
and you can't audit who changed what.

The integrations registry gives you:

- **One UI** for all keys. Group by category, see test status, toggle
  on/off without redeploying.
- **AES-256-GCM at-rest encryption** for secrets. Decryption happens in
  the application layer only when needed.
- **Audit trail** in `super_admin_audit`. Every upsert and test result
  is logged with the admin's identity, IP, and a diff of what changed.
- **Per-integration smoke tests** in `lib/integrations/testers.ts` so
  the admin can validate credentials with one click.
- **Env fallback.** Existing `OPENAI_API_KEY` etc. continue to work
  until you save a row in the DB.

## Schema

`supabase/migrations/00000000000018_platform_integrations.sql`:

```
platform_integrations (
  slug                    text primary key,          -- 'openai', 'whatsapp-cloud', …
  category                text not null,
  display_name            text not null,
  enabled                 boolean default false,
  config                  jsonb default '{}',        -- non-secret config
  encrypted_credentials   jsonb,                     -- AES-256-GCM payload
  test_status             text default 'untested',   -- 'untested' | 'ok' | 'fail'
  last_tested_at          timestamptz,
  last_test_error         text,
  updated_by_admin_id     uuid,
  updated_by_admin_email  text,
  …
)
```

RLS: platform admins only. Service-role bypass for the application layer.

## Catalog

`lib/integrations/catalog.ts` is the single source of truth. Each
descriptor declares:

```ts
{
  slug: "openai",
  name: "OpenAI",
  category: "ai",
  tagline: "GPT-4o + embeddings for every AI agent",
  description: "…",
  docsUrl: "https://platform.openai.com/docs",
  capabilities: [...],
  fields: [
    { key: "api_key", label: "API key", type: "secret", required: true },
    { key: "organization_id", label: "Org ID", type: "text" },
    { key: "default_model", label: "Default model", type: "text" },
  ],
  wired: true,       // a consumer file (lib/ai/openai.ts) reads this
  importance: "core",
}
```

Field types: `text`, `secret`, `url`, `bool`, `select`.

## Consuming an integration

Every consumer follows the same pattern — see `lib/ai/openai.ts` for the
canonical example:

```ts
const resolved = await resolveIntegration("openai", {
  api_key: process.env.OPENAI_API_KEY, // fallback
});
if (!resolved) throw new Error("OpenAI not configured");
const { secrets, config } = resolved;
// secrets.api_key, config.default_model …
```

`resolveIntegration()`:

1. Returns `null` when the slug isn't in the catalog, no row exists,
   **or** `enabled = false`.
2. Decrypts secrets in-process using `INTEGRATION_ENCRYPTION_KEY`.
3. Falls back to env vars when a secret hasn't been migrated to the DB
   yet — keeps existing deployments working.

## Encryption

`lib/integrations/crypto.ts` wraps Node's `crypto`:

- Algorithm: **AES-256-GCM**.
- Key source: `INTEGRATION_ENCRYPTION_KEY` env var (32-byte hex
  recommended; falls back to scrypt-derived key from a passphrase).
- Each ciphertext is `{ v: 1, alg: 'aes-256-gcm', iv, ct, tag }`.
- IV is 12 bytes random per encryption.

**Do not rotate the key once secrets are saved** without running a
migration script that re-encrypts every row. Otherwise every saved
credential becomes unrecoverable.

## API surface

| Method   | Endpoint                                                 | Purpose                              |
| -------- | -------------------------------------------------------- | ------------------------------------ |
| `GET`    | `/api/super-admin/integrations/[slug]`                   | Load row + descriptor (no secrets)   |
| `PATCH`  | `/api/super-admin/integrations/[slug]`                   | Upsert config + secrets + enabled    |
| `POST`   | `/api/super-admin/integrations/[slug]/test`              | Run the smoke-test                   |

All endpoints require `requirePlatformAdmin()`. Every mutation writes a
row to `super_admin_audit`.

## Adding a new integration

1. Append a `IntegrationDescriptor` to `INTEGRATION_CATALOG` in
   `lib/integrations/catalog.ts`. Pick a category (or add one).
2. (Optional) Add a smoke-test runner in `lib/integrations/testers.ts`.
3. Write a consumer that calls `resolveIntegration("your-slug")`.
4. Flip `wired: true` once the consumer is shipped.

That's it — the UI, audit logging, and encryption are inherited for free.

## Recommended integrations (Malaysia-first SaaS)

The catalog already includes the priority list:

| Category | Recommended for v1                        |
| -------- | ----------------------------------------- |
| AI       | OpenAI (core)                             |
| Payments | Billplz (core), iPay88 (alt), Stripe (intl) |
| Comms    | WhatsApp Cloud (core), Resend, Twilio     |
| Social   | Meta (wired), TikTok, YouTube             |
| E-Invoicing | LHDN MyInvois — mandatory from 2026     |
| Logistics | Lalamove, EasyParcel                     |
| Maps     | Google Maps Platform                      |
| Accounting | Xero, QuickBooks (optional)             |
| Analytics | PostHog, GA4                             |
| Storage  | Cloudflare R2 (cost optimisation)         |

## Operations

- The encryption key is environment-scoped. Different envs (dev, staging,
  prod) have different keys, which means saved credentials are per-env.
- Backups: rows in `platform_integrations` are part of the regular
  Supabase backup. Make sure your backup encryption is at least as
  strong as the application-layer encryption (otherwise you've lost the
  point).
- Monitoring: `last_test_error` is a good signal for an external
  monitoring tool to scrape. Anything stuck in `fail` for >24h needs
  attention.
