/**
 * Lightweight language detection for Malaysian users.
 * No external APIs required.
 *
 * Supports:
 * - English
 * - Bahasa Malaysia
 * - Kelantan
 * - Terengganu
 * - Kedah / Northern
 * - Sabah
 * - Sarawak
 * - Mandarin (Simplified)
 * - Mandarin (Traditional)
 * - Cantonese
 * - Hokkien (Romanized)
 * - Tamil
 */

export type UserLanguage =
  | "english"
  | "bahasa_malaysia"
  | "bahasa_kelantan"
  | "bahasa_terengganu"
  | "bahasa_kedah"
  | "bahasa_sabah"
  | "bahasa_sarawak"
  | "mandarin_simplified"
  | "mandarin_traditional"
  | "cantonese"
  | "hokkien"
  | "tamil";

/* -------------------------------------------------------------------------- */
/* Regex Patterns */
/* -------------------------------------------------------------------------- */

const HAS_CHINESE = /[\u4E00-\u9FFF]/;
const HAS_TAMIL = /[\u0B80-\u0BFF]/;

const BM_HINT =
  /\b(saya|awak|anda|kami|kita|dia|mereka|boleh|tak|tidak|nak|mahu|ingin|tolong|bantu|buat|cipta|rekod|jualan|perbelanjaan|pendapatan|invois|laporan|bulan|tahun|hantar|semak|check|duit|bayar)\b/i;

const KELANTAN_HINT =
  /\b(ambo|demo|kito|dio|gapo|guano|guane|napo|nok|bulih|dok|cek|poie|mari|beno|bakpo)\b/i;

const TERENGGANU_HINT =
  /\b(mung|demo|aku|gapo|guane|dok|pitih|molek|bakpo)\b/i;

const KEDAH_HINT =
  /\b(hang|depa|cek|awat|mai|pi|sat|tok sah|lagu tu)\b/i;

const SABAH_HINT =
  /\b(bah|sia|ba|buli|ko|kau|kan bah|juga bah)\b/i;

const SARAWAK_HINT =
  /\b(kamek|kitak|sik|mok|tok|gik|kelak|bah|nang)\b/i;

const TRADITIONAL_HINT =
  /(我們|這個|請問|謝謝|電腦|軟體|資料|為什麼)/;

const SIMPLIFIED_HINT =
  /(我们|这个|请问|谢谢|电脑|软件|资料|为什么)/;

const CANTONESE_HINT =
  /(冇|咩|佢|喺|點解|唔該|係咪|咗|啦|啲|邊個)/;

const HOKKIEN_HINT =
  /\b(wa|lu|bo|si|ai|jia|lim|beh|mai|chia|sui)\b/i;

/* -------------------------------------------------------------------------- */
/* Language Detection */
/* -------------------------------------------------------------------------- */

export function detectUserLanguage(message: string): UserLanguage {
  const text = message.trim();

  if (!text) return "english";

  const score: Record<UserLanguage, number> = {
    english: 0,
    bahasa_malaysia: 0,
    bahasa_kelantan: 0,
    bahasa_terengganu: 0,
    bahasa_kedah: 0,
    bahasa_sabah: 0,
    bahasa_sarawak: 0,
    mandarin_simplified: 0,
    mandarin_traditional: 0,
    cantonese: 0,
    hokkien: 0,
    tamil: 0,
  };

  // Tamil
  if (HAS_TAMIL.test(text)) score.tamil += 100;

  // Chinese
  if (HAS_CHINESE.test(text)) {
    if (CANTONESE_HINT.test(text)) score.cantonese += 100;
    if (TRADITIONAL_HINT.test(text)) score.mandarin_traditional += 80;
    if (SIMPLIFIED_HINT.test(text)) score.mandarin_simplified += 80;

    // Default Chinese -> Simplified
    if (
      score.cantonese === 0 &&
      score.mandarin_traditional === 0 &&
      score.mandarin_simplified === 0
    ) {
      score.mandarin_simplified += 60;
    }
  }

  // Malay dialects
  if (KELANTAN_HINT.test(text)) score.bahasa_kelantan += 20;
  if (TERENGGANU_HINT.test(text)) score.bahasa_terengganu += 20;
  if (KEDAH_HINT.test(text)) score.bahasa_kedah += 20;
  if (SABAH_HINT.test(text)) score.bahasa_sabah += 20;
  if (SARAWAK_HINT.test(text)) score.bahasa_sarawak += 20;
  if (BM_HINT.test(text)) score.bahasa_malaysia += 10;

  // Romanized Hokkien
  if (HOKKIEN_HINT.test(text)) score.hokkien += 20;

  // English words
  const englishWords = text.match(
    /\b(the|is|are|can|please|help|invoice|report|today|tomorrow|project|thanks|thank you|hello|hi|good|morning|afternoon|evening)\b/gi,
  );

  if (englishWords) {
    score.english += englishWords.length;
  }

  // Find highest score
  let detected: UserLanguage = "english";
  let highest = 0;

  for (const [lang, value] of Object.entries(score) as [
    UserLanguage,
    number,
  ][]) {
    if (value > highest) {
      highest = value;
      detected = lang;
    }
  }

  return detected;
}

/* -------------------------------------------------------------------------- */
/* System Prompt */
/* -------------------------------------------------------------------------- */

export function userLanguageInstruction(lang: UserLanguage): string {
  const common =
    "Keep RM amounts, dates (YYYY-MM-DD), invoice numbers, transaction IDs, and technical terms in their original format.";

  switch (lang) {
    case "bahasa_malaysia":
      return `USER LANGUAGE: Bahasa Malaysia. Reply entirely in Bahasa Malaysia. ${common} Use BM headings such as **Ringkasan** and **Langkah Seterusnya**.`;

    case "bahasa_kelantan":
      return `USER LANGUAGE: Kelantan dialect. Reply naturally in Kelantan Malay (ambo, demo, kito, gapo, bulih). ${common}`;

    case "bahasa_terengganu":
      return `USER LANGUAGE: Terengganu dialect. Reply naturally in Terengganu Malay (mung, demo, gapo, molek). ${common}`;

    case "bahasa_kedah":
      return `USER LANGUAGE: Kedah/Northern dialect. Reply naturally in Kedah Malay (hang, depa, mai, pi). ${common}`;

    case "bahasa_sabah":
      return `USER LANGUAGE: Sabah Malay. Reply naturally using Sabah expressions (bah, buli, sia) where appropriate. ${common}`;

    case "bahasa_sarawak":
      return `USER LANGUAGE: Sarawak Malay. Reply naturally using Sarawak expressions (kamek, kitak, sik, mok). ${common}`;

    case "mandarin_simplified":
      return `USER LANGUAGE: Simplified Chinese (简体中文). Reply entirely in Simplified Chinese. ${common} Use headings like **摘要** and **下一步**.`;

    case "mandarin_traditional":
      return `USER LANGUAGE: Traditional Chinese (繁體中文). Reply entirely in Traditional Chinese. ${common} Use headings like **摘要** and **下一步**.`;

    case "cantonese":
      return `USER LANGUAGE: Cantonese. Reply in natural Cantonese using Traditional Chinese characters. ${common}`;

    case "hokkien":
      return `USER LANGUAGE: Hokkien. Reply in Malaysian Hokkien using common romanization unless the user writes Chinese characters. ${common}`;

    case "tamil":
      return `USER LANGUAGE: Tamil (தமிழ்). Reply entirely in Tamil. ${common} Use headings like **சுருக்கம்** and **அடுத்த படி**.`;

    case "english":
    default:
      return `USER LANGUAGE: English. Reply entirely in English. ${common} Use headings like **Summary** and **Next Steps**.`;
  }
}
