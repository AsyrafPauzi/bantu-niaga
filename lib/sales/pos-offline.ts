/**
 * POS offline support — IndexedDB layer
 *
 * Stores:
 *   "catalog"  — cached product/service lists for offline browsing
 *   "queue"    — pending sales that failed to reach the server while offline
 *
 * All calls are safe to make during SSR (they no-op when `indexedDB` is absent).
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "bn-pos";
const DB_VERSION = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineCatalog {
  products: unknown[];
  services: unknown[];
  cachedAt: number; // unix ms
}

export interface OfflineSale {
  id: string; // client-generated uuid to deduplicate
  payload: unknown; // the POST body for /api/sales/pos/checkout
  createdAt: number; // unix ms
  attempts: number;
}

export type SyncResult =
  | { ok: true; saleId: string; receiptData: unknown }
  | { ok: false; saleId: string; error: string };

// ─── DB bootstrap ─────────────────────────────────────────────────────────────

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase | null> {
  if (typeof indexedDB === "undefined") return null; // SSR / Node
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("catalog")) {
        db.createObjectStore("catalog");
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id" });
      }
    },
  });
  return _db;
}

// ─── Catalog cache ────────────────────────────────────────────────────────────

export async function saveCatalog(catalog: OfflineCatalog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.put("catalog", catalog, "latest");
}

export async function loadCatalog(): Promise<OfflineCatalog | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.get("catalog", "latest")) as OfflineCatalog | null;
}

// ─── Offline sale queue ───────────────────────────────────────────────────────

/** Add a pending sale to the offline queue. */
export async function enqueueSale(sale: Omit<OfflineSale, "attempts">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.put("queue", { ...sale, attempts: 0 });
}

/** Return all queued sales ordered by createdAt ascending (oldest first). */
export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await getDb();
  if (!db) return [];
  const all = (await db.getAll("queue")) as OfflineSale[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/** Remove a sale from the queue (after successful sync). */
export async function dequeueSale(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete("queue", id);
}

/** Increment the attempt counter (for debugging / future retry limits). */
export async function incrementAttempts(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const tx = db.transaction("queue", "readwrite");
  const sale = (await tx.store.get(id)) as OfflineSale | undefined;
  if (sale) await tx.store.put({ ...sale, attempts: sale.attempts + 1 });
  await tx.done;
}

/** Count queued sales (used for the UI badge). */
export async function pendingCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return db.count("queue");
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/**
 * Push every queued sale to the server.
 * Returns an array of per-sale results so the UI can report errors.
 * Successfully synced sales are removed from the queue automatically.
 */
export async function syncPendingSales(
  onProgress?: (done: number, total: number) => void,
): Promise<SyncResult[]> {
  const sales = await getPendingSales();
  const results: SyncResult[] = [];

  for (let i = 0; i < sales.length; i++) {
    const sale = sales[i];
    onProgress?.(i, sales.length);
    try {
      await incrementAttempts(sale.id);
      const res = await fetch("/api/sales/pos/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Offline-Sale-Id": sale.id, // for server-side idempotency (future)
        },
        body: JSON.stringify(sale.payload),
      });
      const json = (await res.json()) as { data?: unknown; message?: string; error?: string };
      if (res.ok && json.data) {
        await dequeueSale(sale.id);
        results.push({ ok: true, saleId: sale.id, receiptData: json.data });
      } else {
        results.push({
          ok: false,
          saleId: sale.id,
          error: json.message ?? json.error ?? `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      results.push({
        ok: false,
        saleId: sale.id,
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  onProgress?.(sales.length, sales.length);
  return results;
}
