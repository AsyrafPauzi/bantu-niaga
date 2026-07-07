import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveMycalStateAlias } from "@/lib/hr/state-codes";
import { logger } from "@/lib/logger";

const DEFAULT_MYCAL_BASE = "https://mycal-api.huijun00100101.workers.dev";

export interface ImportedHoliday {
  holiday_date: string;
  name: string;
  state_code: string | null;
  external_id: string;
  source: "mycal" | "bundled";
}

interface MycalHolidayName {
  en?: string;
  ms?: string;
}

interface MycalHolidayRow {
  id?: string;
  date?: string;
  holiday_date?: string;
  name?: string | MycalHolidayName;
}

function mycalBaseUrl(): string {
  return process.env.MYCAL_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_MYCAL_BASE;
}

function pickHolidayName(name: string | MycalHolidayName | undefined): string {
  if (!name) return "Public holiday";
  if (typeof name === "string") return name.slice(0, 160);
  return (name.en ?? name.ms ?? "Public holiday").slice(0, 160);
}

function normalizeMycalRows(
  rows: MycalHolidayRow[],
  stateCode: string | null,
): ImportedHoliday[] {
  const out: ImportedHoliday[] = [];
  for (const row of rows) {
    const date = row.date ?? row.holiday_date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const externalId = row.id ?? `${date}-${pickHolidayName(row.name)}`;
    out.push({
      holiday_date: date,
      name: pickHolidayName(row.name),
      state_code: stateCode,
      external_id: externalId.slice(0, 120),
      source: "mycal",
    });
  }
  return out;
}

async function fetchFromMycal(
  year: number,
  stateCode: string,
): Promise<ImportedHoliday[]> {
  const alias = resolveMycalStateAlias(stateCode);
  if (!alias) {
    throw new Error(`Unsupported state code: ${stateCode}`);
  }

  const url = `${mycalBaseUrl()}/v1/holidays?year=${year}&state=${encodeURIComponent(alias)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`MyCal API returned ${res.status}`);
  }

  const body = (await res.json()) as
    | MycalHolidayRow[]
    | { data?: MycalHolidayRow[]; holidays?: MycalHolidayRow[] };

  const rows = Array.isArray(body)
    ? body
    : (body.holidays ?? body.data ?? []);

  return normalizeMycalRows(rows, stateCode);
}

interface BundledHolidayFile {
  year: number;
  holidays: Array<{
    holiday_date: string;
    name: string;
    state_code: string | null;
    external_id?: string;
  }>;
}

async function fetchFromBundledFallback(
  year: number,
  stateCode: string,
): Promise<ImportedHoliday[]> {
  const filePath = path.join(
    process.cwd(),
    "docs",
    "data",
    `holidays-MY-${year}.json`,
  );
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as BundledHolidayFile;
  if (parsed.year !== year) {
    throw new Error(`Bundled holiday file year mismatch (${parsed.year} vs ${year})`);
  }

  return parsed.holidays
    .filter(
      (row) =>
        row.state_code === null ||
        row.state_code.toUpperCase() === stateCode.toUpperCase(),
    )
    .map((row) => ({
      holiday_date: row.holiday_date,
      name: row.name,
      state_code: row.state_code,
      external_id: (row.external_id ?? row.holiday_date).slice(0, 120),
      source: "bundled" as const,
    }));
}

/**
 * State-aware import: federal + state holidays for the business state.
 * Primary: MyCal free API. Fallback: bundled JSON in repo.
 */
export async function fetchMalaysiaHolidays(
  year: number,
  stateCode: string,
): Promise<ImportedHoliday[]> {
  try {
    return await fetchFromMycal(year, stateCode);
  } catch (error) {
    logger.warn("hr.holidays.mycal_failed", {
      year,
      stateCode,
      error: error instanceof Error ? error.message : String(error),
    });
    return fetchFromBundledFallback(year, stateCode);
  }
}

export function dedupeImportedHolidays(
  rows: ImportedHoliday[],
): ImportedHoliday[] {
  const seen = new Set<string>();
  const out: ImportedHoliday[] = [];
  for (const row of rows) {
    const key = `${row.holiday_date}|${row.name}|${row.state_code ?? "ALL"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
}
