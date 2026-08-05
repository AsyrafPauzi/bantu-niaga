/**
 * Canonical keys for Malaysian public holidays — merges EN/MS duplicates
 * (e.g. Hari Kebangsaan + National Day on the same date).
 */

const CANONICAL_PATTERNS: Array<{ pattern: RegExp; key: string; federal: boolean }> = [
  { pattern: /kebangsaan|national day/i, key: "national-day", federal: true },
  { pattern: /hari malaysia|malaysia day/i, key: "malaysia-day", federal: true },
  { pattern: /pekerja|labour day/i, key: "labour-day", federal: true },
  { pattern: /tahun baharu(?! cina)|new year/i, key: "new-year", federal: false },
  { pattern: /tahun baharu cina|chinese new year/i, key: "cny", federal: true },
  { pattern: /raya aidilfitri|eid al-fitr/i, key: "aidilfitri", federal: true },
  { pattern: /raya haji|eid al-adha|hari raya haji/i, key: "aidilhaji", federal: true },
  { pattern: /wesak/i, key: "wesak", federal: true },
  { pattern: /deepavali/i, key: "deepavali", federal: true },
  { pattern: /christmas/i, key: "christmas", federal: true },
  { pattern: /wilayah|federal territory/i, key: "ft-day", federal: false },
  { pattern: /thaipusam/i, key: "thaipusam", federal: false },
  { pattern: /agong/i, key: "agong-birthday", federal: true },
  { pattern: /maulidur|muhammad/i, key: "maulidur-rasul", federal: true },
];

export interface HolidayDedupeRow {
  holiday_date: string;
  name: string;
  state_code?: string | null;
  external_id?: string | null;
}

export function canonicalHolidayName(name: string): {
  key: string;
  federal: boolean;
} {
  const trimmed = name.trim();
  for (const entry of CANONICAL_PATTERNS) {
    if (entry.pattern.test(trimmed)) {
      return { key: entry.key, federal: entry.federal };
    }
  }
  return { key: trimmed.toLowerCase(), federal: false };
}

/** Stable slot for deduping imports, storage checks, and UI lists. */
export function holidayDedupeKey(row: HolidayDedupeRow): string {
  const { key, federal } = canonicalHolidayName(row.name);
  const statePart =
    federal || row.state_code == null ? "FED" : row.state_code.toUpperCase();
  return `${row.holiday_date}|${key}|${statePart}`;
}

function englishNameScore(name: string): number {
  if (/national day|malaysia day|labour day|federal territory|new year|chinese new year|christmas|deepavali|wesak|eid al-/i.test(name)) {
    return 3;
  }
  if (/^[A-Za-z0-9]/.test(name.trim())) return 2;
  return 1;
}

export function pickPreferredHoliday<T extends HolidayDedupeRow & { id?: string }>(
  a: T,
  b: T,
): T {
  const scoreA = englishNameScore(a.name) + (a.external_id ? 1 : 0);
  const scoreB = englishNameScore(b.name) + (b.external_id ? 1 : 0);
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
  return a.name.length <= b.name.length ? a : b;
}

export function dedupeHolidayRows<T extends HolidayDedupeRow & { id?: string }>(
  rows: T[],
): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    const key = holidayDedupeKey(row);
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickPreferredHoliday(existing, row) : row);
  }
  return [...byKey.values()].sort((a, b) =>
    a.holiday_date.localeCompare(b.holiday_date),
  );
}
