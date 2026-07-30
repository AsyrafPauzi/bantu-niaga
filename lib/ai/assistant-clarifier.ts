/**
 * Free clarifying questions for staff-style assistants (Hana / Maya / Sufi).
 * Templates avoid ILMU token burn; Sufi may also use a cheap smart clarifier.
 * Substantive replies and actions still bill credits.
 */

import {
  detectUserLanguage,
  type UserLanguage,
} from "@/lib/ai/user-language";

export type StaffAssistantKind =
  | "hr"
  | "marketing"
  | "sales"
  | "finance"
  | "operations"
  | "admin";

const CLARIFIER_HEADER_EN = "Before I plan, a few quick questions";
const CLARIFIER_HEADER_BM = "Sebelum saya rancang, beberapa soalan ringkas";
const FREE_NOTE_EN = "_These clarifying questions are free (no credits). Your next reply that gets a plan or action will use credits._";
const FREE_NOTE_BM = "_Soalan penjelasan ini percuma (tiada kredit). Jawapan seterusnya yang beri rancangan atau tindakan akan guna kredit._";

function prefersBahasa(message: string): boolean {
  return detectUserLanguage(message) === "bahasa_malaysia";
}

function financeClarifierForLanguage(
  lang: UserLanguage,
  name: string,
): string[] {
  switch (lang) {
    case "tamil":
      return [
        `நான் **${name}**, உங்கள் நிதி உதவியாளர்.`,
        "",
        "**திட்டமிடுவதற்கு முன், சில கேள்விகள்:**",
        "",
        "1. இலக்கு — செலுத்தப்படாத இன்வாய்ஸ், பணப்புழக்கம், அல்லது இந்த மாத செலவுகள்?",
        "2. காலம் — இந்த வாரம், இந்த மாதம், அல்லது அடுத்த 30 நாட்கள்?",
        "3. கவனம் — இன்வாய்ஸ், செலவு, அல்லது இரண்டும்?",
        "4. நினைவூட்டல் நடை — நட்பு, முறையான, அல்லது குறுகிய?",
        "",
        "ஒரே செய்தியில் பதிலளியுங்கள் — அல்லது **நீங்கள் முடிவு செய்யுங்கள்** என்று எழுதுங்கள்.",
        "",
        "_இந்த தெளிவுபடுத்தல் கேள்விகள் இலவசம் (கிரெடிட் இல்லை). அடுத்த பதில் திட்டம் அல்லது செயலைக் கொண்டு வந்தால் கிரெடிட் பயன்படுத்தப்படும்._",
      ];
    case "mandarin_traditional":
      return [
        `我是 **${name}**，您的財務助手。`,
        "",
        "**在制定計劃前，請先回答幾個問題：**",
        "",
        "1. 目標 — 催收未付發票、預測現金流，還是查看本月支出？",
        "2. 時間 — 本週、本月，還是未來30天？",
        "3. 重點 — 發票、支出，還是兩者？",
        "4. 催收語氣 — 友好、正式，還是簡短？",
        "",
        "請一條訊息回覆 — 或輸入 **你來決定**。",
        "",
        "_這些澄清問題免費（不扣積分）。下一條給出計劃或執行操作的回覆將使用積分。_",
      ];
    case "mandarin_simplified":
    case "cantonese":
      return [
        `我是 **${name}**，您的财务助手。`,
        "",
        "**在制定计划前，请先回答几个问题：**",
        "",
        "1. 目标 — 催收未付发票、预测现金流，还是查看本月支出？",
        "2. 时间 — 本周、本月，还是未来30天？",
        "3. 重点 — 发票、支出，还是两者？",
        "4. 催收语气 — 友好、正式，还是简短？",
        "",
        "请一条消息回复 — 或输入 **你来决定**。",
        "",
        "_这些澄清问题免费（不扣积分）。下一条给出计划或执行操作的回复将使用积分。_",
      ];
    case "hokkien":
      return [
        `Wa **${name}**, lu eh Finance staff.`,
        "",
        "**Chia plan chit pai, ai lim kua kua lang eh soal:**",
        "",
        "1. Mubiao — kejar invois bo bayar, teng cash flow, aseh check chit go eh belanja?",
        "2. Time — chit leh paai, chit go eh goeh, aseh 30 kang?",
        "3. Focus — invois, belanja, aseh nang eh?",
        "4. Chase tone — ho lang, formal, aseh toh toh?",
        "",
        "Hui chiok tiaw — aseh si **lu decide**.",
        "",
        "_Chit eh soal long free (bo kredit). Eh eh tiaw hui long plan aseh action toh sio kredit._",
      ];
    case "bahasa_kelantan":
      return [
        `Ambe **${name}**, staf Kewangan hang.`,
        "",
        "**Sebelum ambo rancang, soalan sikit je:**",
        "",
        "1. Matlamat — kejar invois tak bayar, tengok aliran tunai, atau semak belanja bulan ni?",
        "2. Masa — minggu ni, bulan ni, atau 30 hari akan datang?",
        "3. Fokus — invois, belanja, atau dua-dua?",
        "4. Nada kejar — mesra, formal, atau pendek?",
        "",
        "Jawab dalam satu mesej — atau tulis **hang decide**.",
        "",
        "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
      ];
    case "bahasa_terengganu":
      return [
        `Aku **${name}**, staf Kewangan demo.`,
        "",
        "**Sebelum kito rancang, soalan sikit:**",
        "",
        "1. Matlamat — kejar invois tak bayar, tengok aliran tunai, atau semak belanja bulan ni?",
        "2. Masa — minggu ni, bulan ni, atau 30 hari akan datang?",
        "3. Fokus — invois, belanja, atau dua-dua?",
        "4. Nada kejar — mesra, formal, atau pendek?",
        "",
        "Jawab dalam satu mesej — atau tulis **demo decide**.",
        "",
        "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
      ];
    case "bahasa_kedah":
      return [
        `Aku **${name}**, staf Kewangan hang.`,
        "",
        "**Sebelum aku rancang, soalan sikit je:**",
        "",
        "1. Matlamat — kejar invois tak bayar, tengok aliran tunai, atau semak belanja bulan ni?",
        "2. Masa — minggu ni, bulan ni, atau 30 hari akan datang?",
        "3. Fokus — invois, belanja, atau dua-dua?",
        "4. Nada kejar — mesra, formal, atau pendek?",
        "",
        "Jawab dalam satu mesej — atau tulis **hang decide**.",
        "",
        "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
      ];
    case "bahasa_sabah":
      return [
        `Saya **${name}**, staf Kewangan ko punya.`,
        "",
        "**Sebelum saya plan, tanya sikit bah:**",
        "",
        "1. Matlamat — kejar invois tak bayar, tengok cash flow, atau check belanja bulan ni?",
        "2. Masa — minggu ni, bulan ni, atau 30 hari lagi?",
        "3. Fokus — invois, belanja, atau dua-dua?",
        "4. Nada kejar — mesra, formal, atau pendek?",
        "",
        "Reply satu message — atau tulis **ko decide**.",
        "",
        "_Soalan ni free (tak guna kredit). Next reply yang bagi plan atau action akan guna kredit._",
      ];
    case "bahasa_sarawak":
      return [
        `Kamek **${name}**, staf Kewangan kitak.`,
        "",
        "**Sebelum kamek rancang, soalan sikit jak:**",
        "",
        "1. Matlamat — kejar invois sik bayar, tengok cash flow, atau semak belanja bulan tok?",
        "2. Masa — minggu tok, bulan tok, atau 30 hari kelak?",
        "3. Fokus — invois, belanja, atau dua-dua?",
        "4. Nada kejar — mesra, formal, atau pendek?",
        "",
        "Reply dalam satu message — atau tulis **kitak decide**.",
        "",
        "_Soalan tok free (sik guna kredit). Reply seterusnya yang bagi plan atau action akan guna kredit._",
      ];
    case "bahasa_malaysia":
      return [
        `Saya **${name}**, staf Kewangan anda.`,
        "",
        "**Sebelum saya rancang, beberapa soalan ringkas:**",
        "",
        "1. Matlamat — kejar invois tertunggak, ramal aliran tunai, atau semak perbelanjaan bulan ini?",
        "2. Tempoh — minggu ini, bulan ini, atau 30 hari akan datang?",
        "3. Fokus — invois, perbelanjaan, atau kedua-duanya?",
        "4. Nada kejar bayaran — mesra, formal, atau ringkas?",
        "",
        "Jawab dalam satu mesej — atau tulis **anda decide**.",
        "",
        "_Soalan penjelasan ini percuma (tiada kredit). Jawapan seterusnya yang beri rancangan atau tindakan akan guna kredit._",
      ];
    default:
      return [
        `I'm **${name}**, your Finance staff.`,
        "",
        "**Before I plan, a few quick questions:**",
        "",
        "1. Goal — chase unpaid invoices, forecast cash, or review expenses this month?",
        "2. Timeframe — this week, this month, or next 30 days?",
        "3. Focus — invoices, expenses, or both?",
        "4. Chase tone — friendly, formal, or short?",
        "",
        "Reply in one message — or say **you decide**.",
        "",
        "_These clarifying questions are free (no credits). Your next reply that gets a plan or action will use credits._",
      ];
  }
}

const MARKETING_PLANNING =
  /\b(boost\s+sales|increase\s+sales|sales\s+this\s+month|campaign|win[- ]?back|plan\s+(a\s+)?(promo|campaign|month)|bantu\s+jualan|naikkan\s+jualan|kempen|rancang\s+(jualan|promo|bulan))\b/i;

const HR_PLANNING =
  /\b(help\s+(me\s+)?with\s+hr|hr\s+this\s+month|who\s+needs\s+(my\s+)?attention|plan\s+cover|organise\s+(the\s+)?team|bantu\s+(dengan\s+)?hr|hr\s+bulan\s+ini|siapa\s+perlu\s+perhatian|rancang\s+cover|susun\s+pasukan)\b/i;

const SALES_PLANNING =
  /\b(help\s+(me\s+)?with\s+sales|sales\s+today|chase\s+(leads?|them)|who\s+should\s+i\s+chase|overdue\s+leads?|plan\s+(the\s+)?(floor|counter)|follow[\s-]?up|bantu\s+jualan|jualan\s+hari\s+ini|kejar\s+(lead|prospek)|siapa\s+perlu\s+dihubungi|rancang\s+jualan)\b/i;

const FINANCE_PLANNING =
  /\b(help\s+(me\s+)?with\s+(cash\s*flow|finance)|cash\s*flow|chase\s+invoices?|overdue\s+invoices?|month[\s-]?end|forecast|reconcile|bantu\s+(kewangan|cash\s*flow)|aliran\s+tunai|kejar\s+invois|hujung\s+bulan|rancang\s+kewangan)\b/i;

const OPERATIONS_PLANNING =
  /\b(help\s+(me\s+)?with\s+operations|low\s+stock|reorder|restock|bookings?\s+today|upcoming\s+bookings?|open\s+orders?|supplier|plan\s+(ops|operations)|bantu\s+operasi|stok\s+rendah|tempahan|pesanan\s+terbuka|rancang\s+operasi)\b/i;

const ADMIN_PLANNING =
  /\b(help\s+(me\s+)?with\s+admin|admin\s+today|open\s+tasks?|compliance\s+renewal|licen[cs]e\s+renewal|organise\s+(the\s+)?(storage|documents?|files?)|weekly\s+admin|back[\s-]?office|bantu\s+admin|tugas\s+terbuka|pembaharuan\s+lesen|susun\s+dokumen|rancang\s+admin)\b/i;

export function isPlanningIntent(
  kind: StaffAssistantKind,
  message: string,
): boolean {
  const text = message.trim();
  if (text.length < 8) return false;
  if (kind === "marketing") return MARKETING_PLANNING.test(text);
  if (kind === "sales") return SALES_PLANNING.test(text);
  if (kind === "finance") return FINANCE_PLANNING.test(text);
  if (kind === "operations") return OPERATIONS_PLANNING.test(text);
  if (kind === "admin") return ADMIN_PLANNING.test(text);
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

  if (
    /\b(here'?s\s+(my\s+|the\s+)?plan|cadangan\s+rancangan|action\s+plan|i\s+(will|can)\s+create|saya\s+akan\s+(cipta|buat|rekod)|coupon\s+code|broadcast\s+draft|leave\s+recorded|approved|ditolak|diluluskan|lead\s+created|converted)\b/i.test(
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
  const name =
    displayName ||
    (kind === "hr"
      ? "Hana"
      : kind === "sales"
        ? "Sufi"
        : kind === "finance"
          ? "Fayza"
          : kind === "operations"
            ? "Aiman"
            : kind === "admin"
              ? "Amir"
              : "Maya");

  if (kind === "admin") {
    if (bm) {
      return [
        `Saya **${name}**, staf Admin anda.`,
        "",
        `**${header}:**`,
        "",
        "1. Matlamat — selesaikan tugas terbuka, kejar pembaharuan lesen, atau susun storan dokumen?",
        "2. Tempoh — hari ini, minggu ini, atau bulan ini?",
        "3. Fokus — tugas, pematuhan, atau dokumen?",
        "4. Keutamaan — lesen tertunggak atau kemas rutin?",
        "",
        "Jawab dalam satu mesej — atau tulis **anda decide**.",
        "",
        freeNote,
      ].join("\n");
    }
    return [
      `I'm **${name}**, your Admin staff.`,
      "",
      `**${header}:**`,
      "",
      "1. Goal — clear open tasks, chase licence renewals, or organise document storage?",
      "2. Timeframe — today, this week, or this month?",
      "3. Focus — tasks, compliance, or documents?",
      "4. Priority — overdue renewals or routine tidy-up?",
      "",
      "Reply in one message — or say **you decide**.",
      "",
      freeNote,
    ].join("\n");
  }

  if (kind === "finance") {
    return financeClarifierForLanguage(
      detectUserLanguage(userMessage),
      name,
    ).join("\n");
  }

  if (kind === "operations") {
    if (bm) {
      return [
        `Saya **${name}**, staf Operasi anda.`,
        "",
        `**${header}:**`,
        "",
        "1. Matlamat — stok semula, selesaikan pesanan tertunggak, atau susun tempahan?",
        "2. Tempoh — hari ini atau minggu ini?",
        "3. Fokus — produk, pesanan, atau tempahan?",
        "4. Keutamaan — kerja segera atau stok rutin?",
        "",
        "Jawab dalam satu mesej — atau tulis **anda decide**.",
        "",
        freeNote,
      ].join("\n");
    }
    return [
      `I'm **${name}**, your Operations staff.`,
      "",
      `**${header}:**`,
      "",
      "1. Goal — restock, clear backlog orders, or schedule bookings?",
      "2. Timeframe — today or this week?",
      "3. Focus — products, orders, or bookings?",
      "4. Priority — urgent jobs or routine restock?",
      "",
      "Reply in one message — or say **you decide**.",
      "",
      freeNote,
    ].join("\n");
  }

  if (kind === "sales") {
    if (bm) {
      return [
        `Saya **${name}**, staf Sales anda.`,
        "",
        `**${header}:**`,
        "",
        "1. Matlamat — kejar lead tertunggak, tutup deal won, atau dorong jualan kaunter hari ini?",
        "2. Tempoh — hari ini atau minggu ini?",
        "3. Lead siapa — saya (Mine), semua, atau staf tertentu?",
        "4. Nada mesej kejar — mesra BM, formal, atau ringkas?",
        "",
        "Jawab dalam satu mesej — atau tulis **anda decide**.",
        "",
        freeNote,
      ].join("\n");
    }
    return [
      `I'm **${name}**, your Sales staff.`,
      "",
      `**${header}:**`,
      "",
      "1. Goal — chase overdue leads, close won deals, or push counter sales today?",
      "2. Timeframe — today or this week?",
      "3. Whose leads — Mine, everyone, or a named teammate?",
      "4. Chase message tone — friendly BM, formal, or short?",
      "",
      "Reply in one message — or say **you decide**.",
      "",
      freeNote,
    ].join("\n");
  }

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
