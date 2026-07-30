import type { AdminFileSort } from "@/lib/admin/schemas";

export type StorageListCursor =
  | { sort: "newest"; created_at: string; id: string }
  | { sort: "largest"; file_size_bytes: number; id: string }
  | { sort: "name"; file_name: string; id: string };

export function encodeStorageCursor(cursor: StorageListCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeStorageCursor(
  raw: string,
  sort: AdminFileSort,
): StorageListCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as StorageListCursor;
    if (parsed && typeof parsed === "object" && parsed.sort === sort && parsed.id) {
      return parsed;
    }
  } catch {
    // fall through to legacy cursor
  }

  if (sort === "newest") {
    const idx = raw.lastIndexOf("__");
    if (idx <= 0 || idx >= raw.length - 1) return null;
    const created_at = raw.slice(0, idx);
    const id = raw.slice(idx + 2);
    if (Number.isNaN(Date.parse(created_at))) return null;
    if (!/^[0-9a-f-]{8,}$/i.test(id)) return null;
    return { sort: "newest", created_at, id };
  }

  return null;
}
