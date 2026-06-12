/**
 * Shared types for Marketing M2 UI components.
 *
 * Kept colocated with the components so the API route handlers can
 * import a single canonical shape if they ever need to render server
 * components inline (today they don't).
 */

export interface CustomerListRow {
  id: string;
  name: string;
  phone_e164: string | null;
  email?: string | null;
  address?: string | null;
  manual_tags: string[];
  auto_tags: string[];
  notes?: string | null;
  source: string;
  total_spend_myr: number | string;
  last_purchase_at: string | null;
  order_count: number;
  aov_myr?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerFullRow extends CustomerListRow {
  created_by_user_id: string | null;
  merged_into_id: string | null;
  deleted_at: string | null;
}

export interface CustomerTagHistoryRow {
  id: string;
  prior_auto_tags: string[];
  new_auto_tags: string[];
  computed_at: string;
  run_id: string | null;
}

export type ListSortField = "name" | "last_purchase_at" | "total_spend_myr";
export type ListSortOrder = "asc" | "desc";
