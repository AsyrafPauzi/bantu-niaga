/**
 * Free clarifying questions for staff-style assistants (Hana / Maya).
 * Templates avoid ILMU token burn; substantive replies and actions still bill credits.
 */

export type StaffAssistantKind = "hr" | "marketing";

const CLARIFIER_HEADER_EN = "Before I plan, a few quick questions";
const CLARIFIER_HEADER_BM = "Sebelum saya rancang, beberapa soalan ringkas";
const FREE_NOTE_EN = "_These clarifying questions are free (no credits). Your next reply that gets a plan or action will use credits._";
const FREE_NOTE_BM = "_Soalan penjelasan ini percuma (tiada kredit). Jawapan seterusnya yang beri rancangan atau tindakan akan guna kredit._";

function prefersBahasa(message: string): boolean {
  return /\b(saya|tolong|bantu|bulan|jualan|cuti|pekerja|rancang|soalan)\b/i.test(
    message,
  );
}

const MARKETING_PLANNING =
  /\b(boost\s+sales|increase\s+sales|sales\s+this\s+month|campaign|win[- ]?back|plan\s+(a\s+)?(promo|campaign|month)|bantu\s+jualan|naikkan\s+jualan|kempen|rancang\s+(jualan|promo|bulan))\b/i;

const HR_PLANNING =
  /\b(help\s+(me\s+)?with\s+hr|hr\s+this\s+month|who\s+needs\s+(my\s+)?attention|plan\s+cover|organise\s+(the\s+)?team|bantu\s+(dengan\s+)?hr|hr\s+bulan\s+ini|siapa\s+perlu\s+perhatian|rancang\s+cover|susun\s+pasukan)\b/i;

export function isPlanningIntent(
  kind: StaffAssistantKind,
  message: string,
): boolean {
  const text = message.trim();
  if (text.length < 8) return false;
  if (kind === "marketing") return MARKETING_PLANNING.test(text);
  return HR_PLANNING.test(text);
}

/**
 * Heuristic: reply is mostly clarifying questions, not a plan/action answer.
 */
export function isClarifyingOnlyReply(reply: string): boolean {
  const text = reply.trim();
  if (!text) return false;

  if (
    text.includes(CLARIFIER_HEADER_EN) ||
    text.includes(CLARIFIER_HEADER_BM)
  ) {
    return true;
  }

  const questionMarks = (text.match(/\?/g) ?? []).length;
  if (questionMarks < 2) return false;
  if (text.length > 1000) return false;

  // Substantive plan / action language → billable
  if (
    /\b(here'?s\s+(my\s+|the\s+)?plan|cadangan\s+rancangan|action\s+plan|i\s+(will|can)\s+create|saya\s+akan\s+(cipta|buat|rekod)|coupon\s+code|broadcast\s+draft|leave\s+recorded|approved|ditolak|diluluskan)\b/i.test(
      text,
    )
  ) {
    return false;
  }

  return questionMarks >= 2;
}

export function lastAssistantWasClarifier(
  history: Array<{ role: string; content: string }>,
): boolean {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") {
      return isClarifyingOnlyReply(history[i].content);
    }
  }
  return false;
}

/**
 * First planning turn → free template clarifier (no ILMU).
 * If we already asked clarifiers, the SME's next message is billable.
 */
export function shouldUseFreeClarifierTemplate(
  kind: StaffAssistantKind,
  message: string,
  history: Array<{ role: string; content: string }>,
): boolean {
  if (lastAssistantWasClarifier(history)) return false;
  return isPlanningIntent(kind, message);
}

export function buildFreeClarifierReply(
  kind: StaffAssistantKind,
  displayName: string,
  userMessage: string,
): string {
  const bm = prefersBahasa(userMessage);
  const header = bm ? CLARIFIER_HEADER_BM : CLARIFIER_HEADER_EN;
  const freeNote = bm ? FREE_NOTE_BM : FREE_NOTE_EN;
  const name = displayName || (kind === "hr" ? "Hana" : "Maya");

  if (kind === "marketing") {
    if (bm) {
      return [
        `Saya **${name}**, staf Marketing anda.`,
        "",
        `**${header}:**`,
        "",
        "1. Matlamat utama — lebih pelanggan, habiskan stok lambat, atau naikkan nilai beli?",
        "2. Diskauan maksimum yang anda benarkan (contoh 10%)?",
        "3. Fokus produk/kategori, atau biar saya pilih dari jualan & stok?",
        "4. Sasaran — dormant, VIP, semua, atau segmen tertentu? Saluran — WhatsApp, email, atau kandungan sosial?",
        "",
        "Jawab dalam satu mesej — atau tulis **anda decide**.",
        "",
        freeNote,
      ].join("\n");
    }
    return [
      `I'm **${name}**, your Marketing staff.`,
      "",
      `**${header}:**`,
      "",
      "1. Main goal — more customers, clear slow stock, or higher ticket size?",
      "2. What's the **max discount %** you'll allow?",
      "3. Any product/category to push, or should I choose from sales & catalog?",
      "4. Audience — dormant, VIP, everyone, or a segment? Channel — WhatsApp, email, or social content?",
      "",
      "Reply in one message — or say **you decide**.",
      "",
      freeNote,
    ].join("\n");
  }

  if (bm) {
    return [
      `Saya **${name}**, staf HR anda.`,
      "",
      `**${header}:**`,
      "",
      "1. Matlamat — selesaikan cuti pending, cover staf cuti, lengkapkan onboarding, atau semak baki cuti?",
      "2. Tempoh — minggu ini, bulan ini, atau tarikh tertentu?",
      "3. Fokus siapa — semua staf, nama tertentu, atau peranan?",
      "4. Keutamaan — lulus sekarang, atau rancang dulu?",
      "",
      "Jawab dalam satu mesej — atau tulis **anda decide**.",
      "",
      freeNote,
    ].join("\n");
  }

  return [
    `I'm **${name}**, your HR staff.`,
    "",
    `**${header}:**`,
    "",
    "1. Goal — clear pending leave, cover who is away, finish onboarding, or check leave balances?",
    "2. Timeframe — this week, this month, or a specific date range?",
    "3. Who to focus on — everyone, named staff, or a role?",
    "4. Urgency — approve/act now, or plan first?",
    "",
    "Reply in one message — or say **you decide**.",
    "",
    freeNote,
  ].join("\n");
}

/** Billable when the assistant took an action or gave a real answer/plan. */
export function shouldChargeAssistantTurn(opts: {
  usedActionTool: boolean;
  reply: string;
}): boolean {
  if (opts.usedActionTool) return true;
  return !isClarifyingOnlyReply(opts.reply);
}
