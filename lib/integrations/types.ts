/**
 * Types for the platform-wide API integrations registry.
 *
 * Each integration is described by a `IntegrationDescriptor` (compile-time
 * catalog) and persisted at run-time as a row in
 * `public.platform_integrations` (managed by platform admins only).
 */

export type IntegrationCategory =
  | "ai"
  | "payments"
  | "communication"
  | "social"
  | "maps"
  | "einvoicing"
  | "accounting"
  | "logistics"
  | "analytics"
  | "storage";

export type FieldType =
  /** Plain text (not encrypted). */
  | "text"
  /** Encrypted at rest; UI masks the value once saved. */
  | "secret"
  /** URL with light validation. */
  | "url"
  /** Boolean checkbox (stored as boolean in config jsonb). */
  | "bool"
  /** Closed dropdown of options. */
  | "select";

export interface FieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Help text shown under the input. */
  helper?: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Only used when type='select'. */
  options?: readonly { value: string; label: string }[];
}

export interface IntegrationDescriptor {
  /** Stable identifier, kebab-case. Primary key in DB. */
  slug: string;
  name: string;
  category: IntegrationCategory;
  /** One-line summary for the catalog card. */
  tagline: string;
  /** Longer description shown on the detail page. */
  description: string;
  /** Official docs / API reference URL. */
  docsUrl: string;
  /** What this integration unlocks once configured. */
  capabilities: readonly string[];
  /** Field schema — both non-secret config and secrets. */
  fields: readonly FieldDescriptor[];
  /**
   * True when there is actual code in the app that consumes this integration.
   * False = catalog placeholder (still saveable so the team can stash keys,
   * but the system won't yet do anything with them).
   */
  wired: boolean;
  /**
   * Tier of the relevance for Malaysia-first SMEs:
   *   - 'core'   recommended for every install
   *   - 'recommended' should turn on once you have the volume
   *   - 'optional' nice-to-have / niche
   */
  importance: "core" | "recommended" | "optional";
}

/**
 * Row shape returned by `lib/integrations/load.ts`. Combines the descriptor
 * (compile-time catalog) with the persisted run-time state.
 *
 * Secret field values are NEVER returned — only `secretsConfigured: true|false`
 * per key, so the UI can render "•••• configured" without leaking the
 * actual value to the browser.
 */
export interface IntegrationRow {
  slug: string;
  category: IntegrationCategory;
  displayName: string;
  enabled: boolean;
  /** Non-secret fields stored in `config` jsonb. */
  config: Record<string, unknown>;
  /** Map keyed by field.key, true if that secret has been saved. */
  secretsConfigured: Record<string, boolean>;
  testStatus: "untested" | "ok" | "fail";
  lastTestedAt: string | null;
  lastTestError: string | null;
  updatedByAdminEmail: string | null;
  updatedAt: string;
}
