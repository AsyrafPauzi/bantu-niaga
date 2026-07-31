/**
 * Build a WhatsApp chase message draft for a lead.
 * Returns wa.me URL — owner sends manually; we never auto-send.
 */

export function buildWhatsAppChaseUrl(opts: {
  phoneE164: string;
  leadName: string;
  businessName?: string;
  tone?: "friendly" | "formal";
}): string {
  const digits = opts.phoneE164.replace(/\D/g, "");
  const biz = opts.businessName?.trim() || "kami";
  const name = opts.leadName.trim() || "there";

  const message =
    opts.tone === "formal"
      ? `Assalamualaikum ${name}, saya dari ${biz}. Kami ingin susul semula minat anda. Boleh kami bantu dengan sebarang pertanyaan?`
      : `Hi ${name}! 👋 Ini dari ${biz}. Nak susul balik minat awak — ada apa-apa soalan? Boleh reply bila free ya.`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
