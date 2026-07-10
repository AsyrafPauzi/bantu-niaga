/**
 * Ready-made BM / EN broadcast message templates for Malaysian SMEs.
 * Placeholders: {name}, {first_name}, {coupon_code}
 */
export type BroadcastTemplateLang = "en" | "bm";

export interface BroadcastMessageTemplate {
  id: string;
  lang: BroadcastTemplateLang;
  label: string;
  /** Short chip label in the composer */
  chip: string;
  subject?: string;
  body: string;
}

export const BROADCAST_MESSAGE_TEMPLATES: readonly BroadcastMessageTemplate[] = [
  {
    id: "en-winback",
    lang: "en",
    label: "Win-back",
    chip: "EN · Win-back",
    subject: "{first_name}, we miss you — here's a little something",
    body: "Hi {first_name},\n\nIt's been a while! Come back this week and use {coupon_code} for a special treat.\n\nSee you soon!",
  },
  {
    id: "bm-winback",
    lang: "bm",
    label: "Menarik balik",
    chip: "BM · Win-back",
    subject: "{first_name}, kami rindu anda — ada hadiah kecil",
    body: "Hai {first_name},\n\nDah lama tak jumpa! Datang minggu ni dan guna kod {coupon_code} untuk tawaran istimewa.\n\nJumpa lagi!",
  },
  {
    id: "en-new-menu",
    lang: "en",
    label: "New menu / promo",
    chip: "EN · New promo",
    subject: "Fresh this week for you, {first_name}",
    body: "Hi {first_name},\n\nWe've got something new for you. Show this message or use {coupon_code} when you visit.\n\nThank you for supporting us!",
  },
  {
    id: "bm-new-menu",
    lang: "bm",
    label: "Menu / promo baru",
    chip: "BM · Promo baru",
    subject: "Ada yang baru untuk {first_name}",
    body: "Hai {first_name},\n\nKami ada tawaran baru. Tunjuk mesej ni atau guna kod {coupon_code} bila datang.\n\nTerima kasih sokongan anda!",
  },
  {
    id: "en-raya",
    lang: "en",
    label: "Festive / Raya",
    chip: "EN · Festive",
    subject: "Happy celebrations, {first_name}!",
    body: "Hi {first_name},\n\nWishing you a joyful celebration! Enjoy {coupon_code} on us when you drop by.\n\nWarm regards",
  },
  {
    id: "bm-raya",
    lang: "bm",
    label: "Perayaan / Raya",
    chip: "BM · Raya",
    subject: "Selamat hari raya, {first_name}!",
    body: "Hai {first_name},\n\nSelamat menyambut perayaan! Guna kod {coupon_code} bila datang jumpa kami.\n\nSalam hormat",
  },
  {
    id: "en-vip",
    lang: "en",
    label: "VIP thank you",
    chip: "EN · VIP",
    subject: "A thank-you just for you, {first_name}",
    body: "Hi {first_name},\n\nYou're one of our valued customers. Here's {coupon_code} as a small thank you.\n\nWe appreciate you!",
  },
  {
    id: "bm-vip",
    lang: "bm",
    label: "VIP terima kasih",
    chip: "BM · VIP",
    subject: "Terima kasih khas untuk {first_name}",
    body: "Hai {first_name},\n\nAnda pelanggan istimewa kami. Ini kod {coupon_code} sebagai tanda terima kasih.\n\nKami hargai anda!",
  },
] as const;
