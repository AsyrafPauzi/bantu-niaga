/**
 * Golden-file + edge-case tests for the hand-rolled CSV parser in
 * `lib/marketing/csv.ts`. No DB; no Supabase; runs on the default
 * `node` Vitest environment.
 *
 * The tests cover the entire surface contracted in plan §8.1 +
 * decisions doc Q9:
 *   - Header synonyms (case-insensitive, common aliases)
 *   - BOM stripping
 *   - Comma vs semicolon delimiter sniffing
 *   - Quoted strings with embedded commas + newlines
 *   - Doubled-quote escape sequence
 *   - Pipe + semicolon for manual_tags
 *   - Missing required columns → header-level error
 *   - Blank lines silently skipped
 *   - Truncated rows tolerated (right-padded)
 *   - Round-trip: toCsv() → parseCsv() yields equivalent data
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseCsv,
  toCsv,
  buildSampleCsv,
  HEADER_SYNONYMS,
  CsvParseFatal,
  SAMPLE_COLUMNS,
} from "@/lib/marketing/csv";

function fixture(name: string): string {
  return readFileSync(
    resolve(process.cwd(), "tests/marketing/fixtures", name),
    "utf8",
  );
}

describe("parseCsv — happy path", () => {
  it("parses the clean fixture into 3 rows", () => {
    const r = parseCsv(fixture("customers-clean.csv"));
    expect(r.errors).toEqual([]);
    expect(r.delimiter).toBe(",");
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toEqual({
      row_number: 1,
      name: "Ali bin Abu",
      phone: "012-345 6789",
      email: "ali@example.com",
      address: "12 Jalan Mawar, Bangsar",
      notes: "Regular",
      manual_tags: ["vip", "repeat"],
    });
    expect(r.rows[1]).toEqual({
      row_number: 2,
      name: "Siti Sara",
      phone: "+60134567890",
      email: "siti@example.com",
      address: "",
      notes: "Pickup Fridays",
      manual_tags: ["kedai-runcit"],
    });
    expect(r.rows[2].name).toBe("Rahman Cikgu");
    expect(r.rows[2].manual_tags).toEqual([]);
  });

  it("strips a UTF-8 BOM and sniffs semicolon delimiter", () => {
    const r = parseCsv(fixture("customers-bom-semicolon.csv"));
    expect(r.errors).toEqual([]);
    expect(r.delimiter).toBe(";");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].name).toBe("Pak Rahim");
    expect(r.rows[0].manual_tags).toEqual(["vip", "gold"]);
  });

  it("accepts header synonyms (case-insensitive)", () => {
    const csv = [
      "Full_Name,Mobile,EmailAddress,Alamat,Remarks,Labels",
      "Mat,0123456789,m@x.com,KL,note,vip",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      name: "Mat",
      phone: "0123456789",
      email: "m@x.com",
      address: "KL",
      notes: "note",
      manual_tags: ["vip"],
    });
  });

  it("handles quoted fields with embedded commas and newlines", () => {
    const csv = [
      "name,phone,address,notes,manual_tags,email",
      '"Quoted, Name",0123456789,"Line1\nLine2","She said ""hi""",,',
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].name).toBe("Quoted, Name");
    expect(r.rows[0].address).toBe("Line1\nLine2");
    expect(r.rows[0].notes).toBe('She said "hi"');
  });
});

describe("parseCsv — edge cases", () => {
  it("flags missing required columns at row 0", () => {
    const csv = ["nickname,email", "Bob,b@x.com"].join("\n");
    const r = parseCsv(csv);
    expect(r.rows).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].row_number).toBe(0);
    expect(r.errors[0].reason).toMatch(/Missing required column/i);
    expect(r.errors[0].reason).toMatch(/name/);
    expect(r.errors[0].reason).toMatch(/phone/);
  });

  it("flags an empty file", () => {
    const r = parseCsv("");
    expect(r.rows).toEqual([]);
    expect(r.errors[0].reason).toMatch(/empty/i);
  });

  it("silently skips blank lines between data rows", () => {
    const csv = [
      "name,phone",
      "Alice,0111111111",
      "",
      "   ",
      "Bob,0122222222",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((row) => row.name)).toEqual(["Alice", "Bob"]);
  });

  it("right-pads truncated rows (missing trailing cells become empty strings)", () => {
    const csv = ["name,phone,email,notes", "Alice,0111111111"].join("\n");
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      name: "Alice",
      phone: "0111111111",
      email: "",
      notes: "",
    });
  });

  it("throws CsvParseFatal on unterminated quoted field", () => {
    const csv = 'name,phone\n"unterminated,0123456789';
    expect(() => parseCsv(csv)).toThrow(CsvParseFatal);
  });

  it("ignores extra columns the header didn't declare", () => {
    const csv = [
      "name,phone,extra_col_1,extra_col_2",
      "Alice,0111111111,whatever,whatever_else",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].name).toBe("Alice");
    expect(r.rows[0].phone).toBe("0111111111");
  });

  it("supports semicolon-separated manual_tags inside a comma-delimited file", () => {
    const csv = [
      "name,phone,manual_tags",
      "Alice,0111111111,vip;gold;kedai-runcit",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows[0].manual_tags).toEqual(["vip", "gold", "kedai-runcit"]);
  });

  it("recognises only the FIRST occurrence of each canonical header (duplicates ignored)", () => {
    const csv = ["name,name,phone", "First,Second,012345"].join("\n");
    const r = parseCsv(csv);
    expect(r.rows[0].name).toBe("First");
  });
});

describe("HEADER_SYNONYMS", () => {
  it("maps mobile + full_name to canonical names", () => {
    expect(HEADER_SYNONYMS.mobile).toBe("phone");
    expect(HEADER_SYNONYMS.full_name).toBe("name");
    expect(HEADER_SYNONYMS.fullname).toBe("name");
    expect(HEADER_SYNONYMS.hp).toBe("phone");
  });
});

describe("toCsv", () => {
  it("quotes fields with commas, quotes, newlines", () => {
    const out = toCsv(
      [
        { a: "plain", b: "with, comma", c: 'with "quote"', d: "with\nnewline" },
      ],
      ["a", "b", "c", "d"],
    );
    // The embedded newline inside the last cell stays inside the quoted
    // field, so a naive `split("\n")` would tear it apart. Assert on the
    // full string so we don't accidentally validate that bug.
    expect(out).toBe(
      'a,b,c,d\nplain,"with, comma","with ""quote""","with\nnewline"\n',
    );
  });

  it("pipe-joins arrays", () => {
    const out = toCsv([{ tags: ["vip", "gold"] }], ["tags"]);
    expect(out).toBe("tags\nvip|gold\n");
  });

  it("renders null / undefined as empty cells", () => {
    const out = toCsv([{ a: null, b: undefined, c: "x" }], ["a", "b", "c"]);
    expect(out).toBe("a,b,c\n,,x\n");
  });

  it("renders Date as ISO string", () => {
    const d = new Date("2026-06-12T07:00:00.000Z");
    const out = toCsv([{ at: d }], ["at"]);
    expect(out).toBe("at\n2026-06-12T07:00:00.000Z\n");
  });

  it("round-trips: parseCsv(toCsv(rows)) preserves all field values", () => {
    const rows = [
      {
        name: "Ali, Jr.",
        phone: "+60123456789",
        email: "ali@example.com",
        address: 'Multi\nline\n"quoted"',
        notes: "",
        manual_tags: ["vip", "gold"],
      },
      {
        name: "Siti Sara",
        phone: "+60134567890",
        email: "",
        address: "",
        notes: "",
        manual_tags: [],
      },
    ];
    const csv = toCsv(rows, [...SAMPLE_COLUMNS]);
    const reparsed = parseCsv(csv);
    expect(reparsed.errors).toEqual([]);
    expect(reparsed.rows[0]).toMatchObject({
      name: "Ali, Jr.",
      phone: "+60123456789",
      email: "ali@example.com",
      address: 'Multi\nline\n"quoted"',
      manual_tags: ["vip", "gold"],
    });
    expect(reparsed.rows[1].name).toBe("Siti Sara");
  });
});

describe("buildSampleCsv", () => {
  it("parses cleanly with no errors", () => {
    const sample = buildSampleCsv();
    const r = parseCsv(sample);
    expect(r.errors).toEqual([]);
    expect(r.rows.length).toBeGreaterThanOrEqual(3);
  });
});
