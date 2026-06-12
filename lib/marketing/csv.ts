/**
 * Bantu Niaga — CSV parse + render helpers for Marketing M3.
 *
 * Hand-rolled (RFC 4180-ish) parser + writer, intentionally avoiding the
 * `papaparse` dependency for v1: the CSV import surface only ever sees a
 * 5 MB / 5,000-row payload, and the parser surface area is small enough
 * to test exhaustively via golden fixtures.
 *
 * What the parser handles:
 *   - BOM stripping (UTF-8 BOM \uFEFF at start of file)
 *   - Comma OR semicolon delimiter (sniffed from the header row — covers
 *     Excel exports with European locale)
 *   - Quoted fields with `""` as the escape sequence for a literal `"`
 *   - Embedded newlines inside quoted fields
 *   - \n and \r\n line endings
 *   - Empty rows (silently skipped)
 *   - Trailing blank fields
 *
 * What it deliberately does NOT do:
 *   - Auto-detect arbitrary delimiters (tabs, pipes) — too magical for v1.
 *   - Recover from malformed quoting beyond reporting an error.
 *
 * Header parsing is deterministic and forgiving:
 *   - Case-insensitive
 *   - Trim whitespace
 *   - Common synonyms accepted (`mobile` → `phone`, `full_name` → `name`)
 *
 * @see docs/plans/marketing-implementation-plan.md §8.1
 * @see docs/plans/marketing-decisions.md Q9
 */

/** Canonical column names used by the rest of the pipeline. */
export type CanonicalColumn =
  | "name"
  | "phone"
  | "email"
  | "address"
  | "notes"
  | "manual_tags";

/**
 * Header synonyms → canonical column name. Document this table in the
 * sample CSV download so owners know what aliases are accepted.
 */
export const HEADER_SYNONYMS: Record<string, CanonicalColumn> = {
  // name
  name: "name",
  full_name: "name",
  fullname: "name",
  customer_name: "name",
  // phone
  phone: "phone",
  phone_number: "phone",
  phonenumber: "phone",
  mobile: "phone",
  mobile_number: "phone",
  mobile_phone: "phone",
  hp: "phone",
  // email
  email: "email",
  email_address: "email",
  emailaddress: "email",
  // address
  address: "address",
  addr: "address",
  alamat: "address",
  // notes
  notes: "notes",
  note: "notes",
  comment: "notes",
  comments: "notes",
  remark: "notes",
  remarks: "notes",
  // manual tags
  manual_tags: "manual_tags",
  tags: "manual_tags",
  manualtags: "manual_tags",
  labels: "manual_tags",
};

/**
 * Single parsed row, AFTER header normalization. The shape mirrors the
 * required + optional fields in the CSV contract.
 *
 * `row_number` is 1-based from the operator's perspective: row 1 is the
 * first DATA row (skipping the header), so the owner can open the CSV
 * in Excel/Sheets and jump to the offending line by adding 1 (because
 * Excel row 1 is the header).
 */
export interface ParsedRow {
  row_number: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  manual_tags: string[];
}

export interface ParseError {
  row_number: number;
  reason: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  delimiter: "," | ";";
  total_data_rows: number;
}

export class CsvParseFatal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseFatal";
  }
}

const BOM = "\uFEFF";

/**
 * Tokenize a CSV string into a 2-D array of fields. Returns one inner
 * array per row, including the header row. Rows that contain only
 * empty fields are skipped (counted as blank lines).
 *
 * Throws `CsvParseFatal` only on irrecoverable parse state (unterminated
 * quoted field at EOF). Everything else is delegated to the caller to
 * decide.
 */
function tokenize(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const flushField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const flushRow = () => {
    flushField();
    // Skip rows that have no content after trimming each cell — covers
    // both fully-blank lines and lines that are just whitespace (an
    // Excel "delete row" leaves the visual row in place).
    if (row.some((f) => f.trim().length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  const n = input.length;
  let i = 0;
  while (i < n) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < n && input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      i += 1;
      continue;
    }

    if (ch === delimiter) {
      flushField();
      i += 1;
      continue;
    }

    if (ch === "\n") {
      flushRow();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      flushRow();
      i += 1;
      if (i < n && input[i] === "\n") i += 1;
      continue;
    }

    field += ch;
    fieldStarted = true;
    i += 1;
  }

  if (inQuotes) {
    throw new CsvParseFatal(
      "Unterminated quoted field — check for an unbalanced \" character.",
    );
  }

  // Final flush (last row may not end with newline).
  if (field.length > 0 || row.length > 0) {
    flushRow();
  }

  return rows;
}

/**
 * Sniff `;` vs `,` from the first non-blank line of the input.
 *
 * Heuristic: prefer the delimiter with the higher count outside quoted
 * regions. Defaults to `,` on a tie.
 */
function sniffDelimiter(input: string): "," | ";" {
  let i = 0;
  const n = input.length;
  // Skip leading BOM + blank lines.
  if (input.startsWith(BOM)) i = 1;
  while (i < n) {
    while (i < n && (input[i] === "\n" || input[i] === "\r")) i += 1;
    if (i >= n) break;
    const lineStart = i;
    while (i < n && input[i] !== "\n" && input[i] !== "\r") i += 1;
    const line = input.slice(lineStart, i);
    if (line.trim().length === 0) continue;
    // Count outside quotes.
    let commas = 0;
    let semis = 0;
    let inQ = false;
    for (let j = 0; j < line.length; j += 1) {
      const ch = line[j];
      if (ch === '"') {
        if (inQ && line[j + 1] === '"') {
          j += 1;
        } else {
          inQ = !inQ;
        }
      } else if (!inQ) {
        if (ch === ",") commas += 1;
        else if (ch === ";") semis += 1;
      }
    }
    return semis > commas ? ";" : ",";
  }
  return ",";
}

/**
 * Parse a manual_tags cell. Accepts both pipe (`|`) and semicolon (`;`)
 * separators per the spec ambiguity (plan §8.1 says pipe; M3 spec sheet
 * says semicolon). Trims each entry and drops empties.
 *
 * If the cell delimiter for the file is `;`, semicolons inside manual_tags
 * would never reach this function (they'd already be split as columns),
 * so the fallback to `;` is only useful when the file delimiter is `,`.
 */
function parseManualTags(cell: string): string[] {
  if (!cell) return [];
  // Split on pipe first; if the result is a single entry containing
  // semicolons, split on those too. This makes both formats work.
  const primary = cell.split("|").map((t) => t.trim()).filter(Boolean);
  if (primary.length === 1 && primary[0].includes(";")) {
    return primary[0]
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return primary;
}

/**
 * Parse a CSV string into a normalized list of rows + errors. Never
 * throws unless the input is structurally unparseable (unterminated
 * quoted field); per-row issues are returned in `errors`.
 *
 * - Header row is required. Missing required columns (`name`, `phone`)
 *   produce a single header-level error and an empty `rows` array.
 * - Empty rows are silently skipped (they don't appear in `rows` or
 *   `errors`).
 * - Extra columns the header didn't declare are ignored.
 * - Rows that have fewer cells than the header has columns are
 *   right-padded with empty strings (not flagged as errors — this is
 *   the common Excel save-without-trailing-commas case).
 */
export function parseCsv(input: string): ParseResult {
  if (typeof input !== "string") {
    throw new CsvParseFatal("parseCsv: input must be a string.");
  }

  let text = input;
  if (text.startsWith(BOM)) {
    text = text.slice(1);
  }

  const delimiter = sniffDelimiter(text);
  const rows = tokenize(text, delimiter);

  if (rows.length === 0) {
    return {
      rows: [],
      errors: [{ row_number: 0, reason: "File is empty." }],
      delimiter,
      total_data_rows: 0,
    };
  }

  const header = rows[0].map((h) => h.replace(/^\uFEFF/, "").trim().toLowerCase());
  const colIndex: Partial<Record<CanonicalColumn, number>> = {};
  for (let i = 0; i < header.length; i += 1) {
    const raw = header[i];
    const canonical = HEADER_SYNONYMS[raw];
    if (canonical && colIndex[canonical] === undefined) {
      colIndex[canonical] = i;
    }
  }

  if (colIndex.name === undefined || colIndex.phone === undefined) {
    const missing: string[] = [];
    if (colIndex.name === undefined) missing.push("name");
    if (colIndex.phone === undefined) missing.push("phone");
    return {
      rows: [],
      errors: [
        {
          row_number: 0,
          reason: `Missing required column(s): ${missing.join(", ")}. Headers were: ${header.join(", ")}`,
        },
      ],
      delimiter,
      total_data_rows: 0,
    };
  }

  const out: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (let r = 1; r < rows.length; r += 1) {
    const dataRowNumber = r; // 1-based, header excluded
    const cells = rows[r];
    const cellAt = (idx: number | undefined): string =>
      idx !== undefined && idx < cells.length ? cells[idx].trim() : "";

    const name = cellAt(colIndex.name);
    const phone = cellAt(colIndex.phone);
    const email = cellAt(colIndex.email);
    const address = cellAt(colIndex.address);
    const notes = cellAt(colIndex.notes);
    const manual_tags = parseManualTags(cellAt(colIndex.manual_tags));

    out.push({
      row_number: dataRowNumber,
      name,
      phone,
      email,
      address,
      notes,
      manual_tags,
    });
  }

  return {
    rows: out,
    errors,
    delimiter,
    total_data_rows: out.length,
  };
}

// ─────────────────────────────────────────────────────────────────────
// CSV render
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns a CSV-escaped representation of `value`.
 *
 * Rules (RFC 4180):
 *   - If the value contains a comma, double-quote, CR, or LF, wrap the
 *     whole field in double quotes and replace any literal `"` with `""`.
 *   - Otherwise, return as-is.
 *
 * Numbers and dates are stringified via `String(value)`. `null` and
 * `undefined` become empty strings.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value.join("|")
        : value instanceof Date
          ? value.toISOString()
          : String(value);
  if (s.length === 0) return "";
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Render an array of records into a CSV string. `columns` is the column
 * order + the keys to look up on each row. Always emits a header row.
 * Always uses `\n` line endings (Excel + Numbers + Sheets all open it
 * correctly; using `\r\n` doubles line endings on Unix terminals).
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly string[],
): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCell(c)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

// ─────────────────────────────────────────────────────────────────────
// Sample CSV (also rendered client-side in <CsvSampleDownload>)
// ─────────────────────────────────────────────────────────────────────

/** Canonical column order for the sample download + the import contract. */
export const SAMPLE_COLUMNS: readonly CanonicalColumn[] = [
  "name",
  "phone",
  "email",
  "address",
  "notes",
  "manual_tags",
] as const;

/**
 * Returns a short, copy-paste-ready sample CSV. Documents the header
 * synonyms in a leading comment row Excel users tend to delete; if they
 * keep it, our parser sees it as a non-canonical header that fails the
 * required-column check and surfaces a clear error.
 */
export function buildSampleCsv(): string {
  return [
    "name,phone,email,address,notes,manual_tags",
    'Ali bin Abu,012-345 6789,ali@example.com,"12 Jalan Mawar, Bangsar",Regular customer,vip|repeat',
    "Siti Sara,+60134567890,siti@example.com,,Pickup Fridays,kedai-runcit",
    "Rahman Cikgu,019-2223344,,,New from Raya promo,",
  ].join("\n") + "\n";
}
