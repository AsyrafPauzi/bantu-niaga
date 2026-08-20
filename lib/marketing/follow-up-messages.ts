export type FollowUpReason = "dormant" | "no_purchase" | "check_in";

export function buildFollowUpMessages(input: {
  reason: FollowUpReason;
  customerName: string;
  businessName?: string;
}): { en: string; ms: string } {
  const name = input.customerName.trim() || "there";
  const shop = input.businessName?.trim();

  if (input.reason === "dormant") {
    return {
      en: shop
        ? `Hi ${name}, we miss you at ${shop}! Come by anytime — we'd love to see you again.`
        : `Hi ${name}, we miss you! Come by anytime — we'd love to see you again.`,
      ms: shop
        ? `Hai ${name}, kami rindu anda di ${shop}! Sila datang bila-bila masa — kami ingin jumpa lagi.`
        : `Hai ${name}, kami rindu anda! Sila datang bila-bila masa — kami ingin jumpa lagi.`,
    };
  }

  if (input.reason === "no_purchase") {
    return {
      en: shop
        ? `Hi ${name}, this is ${shop}. Ready when you are — reply here if you need anything.`
        : `Hi ${name}, ready when you are — reply here if you need anything.`,
      ms: shop
        ? `Hai ${name}, ini dari ${shop}. Kami sedia membantu — balas di sini jika ada soalan.`
        : `Hai ${name}, kami sedia membantu — balas di sini jika ada soalan.`,
    };
  }

  return {
    en: shop
      ? `Hi ${name}, just checking in from ${shop}. Hope you're well!`
      : `Hi ${name}, just checking in. Hope you're well!`,
    ms: shop
      ? `Hai ${name}, sekadar menanyakan khabar dari ${shop}. Semoga sihat!`
      : `Hai ${name}, sekadar menanyakan khabar. Semoga sihat!`,
  };
}

export function waMeUrl(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
