/**
 * Post-process LLM assistant replies — strip leaked chain-of-thought and repetition loops.
 */

const MONOLOGUE_SEGMENT =
  /\s*\*(?:I'll|I will|I'm|I am|no,?|okay|wait|hmm|let me)[^*\n]{0,160}\*/gi;

/**
 * Some models leak "thinking" as *italic* asides or repeat the same summary many times.
 * Returns a single clean user-facing reply.
 */
export function sanitizeAssistantReply(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  text = text.replace(MONOLOGUE_SEGMENT, "");
  text = text.replace(/\s*→\s*/g, " ");

  text = collapseRepeatingMarkerBlocks(text, "**MTD Income**");
  text = collapseRepeatingMarkerBlocks(text, "**MTD Expense**");
  text = collapseRepeatingMarkerBlocks(text, "MTD Income");

  if ((text.match(/\|/g) ?? []).length >= 3) {
    const pipeParts = text.split("|").map((p) => p.trim()).filter(Boolean);
    if (pipeParts.length > 1) {
      const keys = pipeParts.map((p) => normalizeBlockKey(p));
      if (keys[0] && keys.filter((k) => k === keys[0]).length > 1) {
        text = pipeParts[0]!;
      }
    }
  }

  text = dedupeParagraphs(text);
  text = dedupeLines(text);

  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || raw.trim();
}

const SUCCESS_LINE =
  /^(?:✅\s*)?(?:Entri berjaya dicatatkan|Berjaya dicatat|Successfully (?:logged|recorded)|Recorded successfully)/i;

const INTERNAL_PATH =
  /\/(?:finance|operations|sales|settings|marketplace|home|more|admin|hr|marketing)(?:\/[a-z][a-z0-9/-]*)?/i;

const MARKDOWN_LINK = /\[[^\]]*\]\([^)]*\)/g;

function linkBarePathsInSegment(segment: string): string {
  return segment.replace(
    new RegExp(`(^|[\\s,:;])(${INTERNAL_PATH.source})`, "gi"),
    (_, before: string, path: string) => `${before}[${path}](${path})`,
  );
}

/** Collapse nested/broken markdown links and link only truly bare paths. */
export function normalizeAssistantLinks(text: string): string {
  let result = text.trim();
  if (!result) return result;

  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(
      /\[\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,
      (_, label: string, _innerHref: string, outerHref: string) =>
        `[${label}](${outerHref})`,
    );
  }

  const parts: string[] = [];
  let lastIndex = 0;
  for (const match of result.matchAll(MARKDOWN_LINK)) {
    const index = match.index ?? 0;
    parts.push(linkBarePathsInSegment(result.slice(lastIndex, index)));
    parts.push(match[0]!);
    lastIndex = index + match[0]!.length;
  }
  parts.push(linkBarePathsInSegment(result.slice(lastIndex)));

  return parts.join("");
}

/** Remove empty or broken ** markers the model sometimes emits. */
export function fixBrokenBoldMarkdown(text: string): string {
  let result = text;
  result = result.replace(/\*\*\s*\*\*/g, "");
  result = result.replace(/\s\*\*\s+(?=[a-z])/gi, " ");
  result = result.replace(/\*\*\s+(?=[,.;:!?)])/g, "");
  result = result.replace(/(^|[\s(])\*\*(?=\s|$)/g, "$1");
  return result.replace(/[ \t]{2,}/g, " ").trim();
}

function parseMarkdownTableBlock(block: string): {
  headers: string[];
  rows: string[][];
} | null {
  const lines = block
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));

  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const headers = parseRow(lines[0]!);
  if (headers.length < 2 || headers.every((h) => !h)) return null;

  const bodyLines = lines.slice(1).filter((line) => !/^[\s|:-]+$/.test(line));
  if (bodyLines.length === 0) return null;

  const rows = bodyLines.map(parseRow).filter((row) => row.some((cell) => cell));
  if (rows.length === 0) return null;

  return { headers, rows };
}

/** Turn markdown tables into scannable bullet lines for assistants that emit pipes. */
export function convertMarkdownTablesToBullets(text: string): string {
  const blocks = text.split(/\n{2,}/);
  const out: string[] = [];

  for (const block of blocks) {
    const table = parseMarkdownTableBlock(block);
    if (!table) {
      out.push(block);
      continue;
    }

    const { headers, rows } = table;
    const bullets = rows.map((row) => {
      const parts = headers
        .map((header, index) => {
          const value = row[index]?.trim();
          if (!value) return null;
          const label = header.toLowerCase();
          if (label.includes("name") || label.includes("title")) {
            return `**${value}**`;
          }
          if (label.includes("price") || label.includes("amount")) {
            return value.startsWith("RM") ? value : `RM ${value}`;
          }
          if (label.includes("sku") || label.includes("id")) {
            return `\`${value}\``;
          }
          return `${header}: ${value}`;
        })
        .filter(Boolean);
      return `- ${parts.join(" · ")}`;
    });

    out.push(bullets.join("\n"));
  }

  return out.join("\n\n");
}

/**
 * Insert paragraph breaks and links so cramped model output renders cleanly.
 */
export function beautifyAssistantMarkdown(raw: string): string {
  let text = fixBrokenBoldMarkdown(raw.trim());
  if (!text) return text;

  text = convertMarkdownTablesToBullets(text);
  text = text.replace(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+(\*\*)/gi,
    "$1\n\n$2",
  );

  // Cramped inline lists: " - **Label:**" → proper bullet lines
  text = text.replace(/\s+-\s+(\*\*[^*]+:\*\*)/g, "\n- $1");

  // Blank line between section heading and first bullet
  text = text.replace(/(\*\*[^*\n]+:\*\*)\n(- \*\*)/g, "$1\n\n$2");

  // Break before major section headers when glued to prior text
  text = text.replace(
    /([^\n])\s+(\*\*(?:Ringkasan|Kesan|Langkah|MTD|Summary|Impact|Transaksi)[^*]+\*\*:?)/gi,
    "$1\n\n$2",
  );

  text = normalizeAssistantLinks(text);

  text = text.replace(
    /\s*\*\*(Langkah seterusnyo?|Seterusnya|Next steps?|Next step|下一步|后续步骤|அடுத்த படி|அடுத்த நடவடிக்கை):\*\*/gi,
    "\n\n---\n\n**$1:**",
  );

  return fixBrokenBoldMarkdown(text.replace(/\n{3,}/g, "\n\n").trim());
}

/** Sanitize leaked reasoning, then beautify markdown structure. */
export function formatAssistantReply(raw: string): string {
  return beautifyAssistantMarkdown(sanitizeAssistantReply(raw));
}

export { SUCCESS_LINE };

const SECTION_HEADER =
  /^\*\*(?:Ringkasan|Kesan|Langkah seterusnya|Seterusnya|Next steps?|Summary|Impact|Transaksi)[^*]*\*\*:?$/i;

export { SECTION_HEADER };

function normalizeBlockKey(block: string): string {
  return block.replace(/\s+/g, " ").toLowerCase().slice(0, 100);
}

function collapseRepeatingMarkerBlocks(text: string, marker: string): string {
  const first = text.indexOf(marker);
  if (first === -1) return text;
  const second = text.indexOf(marker, first + marker.length);
  if (second === -1) return text;
  return text.slice(0, second).trim();
}

function dedupeParagraphs(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of paragraphs) {
    const key = normalizeBlockKey(p);
    if (seen.has(key)) break;
    seen.add(key);
    unique.push(p);
  }
  return unique.join("\n\n");
}

function dedupeLines(text: string): string {
  const lines = text.split("\n");
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const key = line.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key) {
      unique.push(line);
      continue;
    }
    if (seen.has(key)) break;
    seen.add(key);
    unique.push(line);
  }
  return unique.join("\n");
}
