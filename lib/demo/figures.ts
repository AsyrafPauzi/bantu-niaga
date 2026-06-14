/**
 * Per-business demo figures.
 *
 * Pillars that have no real data services yet (Finance ledger, Operations
 * inventory, Sales POS, HR, content engagement, channel reach) still need
 * to look populated on the Home and Marketing dashboards. Rather than
 * sprinkling "sample" labels and identical numbers across every business
 * — which makes the demo feel fake — we derive a stable set of figures
 * from a hash of the business id.
 *
 * Properties:
 *   1. Deterministic: same business id → same numbers on every render.
 *   2. Varied across tenants: two businesses see different headlines.
 *   3. Plausible: bounded ranges that match a Malaysian SME doing ~RM
 *      40k–80k revenue per month.
 *
 * All functions are pure and synchronous; safe to call from server
 * components.
 */

function hash32(seed: string): number {
  // FNV-1a 32-bit — good enough for deterministic UI seeds; not crypto.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Returns a deterministic pseudo-random number in `[lo, hi)` for the
 * given (seed, key) pair. The same combination always returns the same
 * value.
 */
function pick(seed: string, key: string, lo: number, hi: number): number {
  const h = hash32(`${seed}::${key}`);
  const t = (h >>> 0) / 0xffffffff;
  return lo + t * (hi - lo);
}

function pickInt(seed: string, key: string, lo: number, hi: number): number {
  return Math.floor(pick(seed, key, lo, hi + 1));
}

export interface DemoFigures {
  /** Headline revenue MTD in MYR. */
  revenueMtd: number;
  /** Percentage delta vs last month (0–25). */
  revenueGrowthPct: number;
  /** Outstanding AR in MYR. */
  outstanding: number;
  /** Count of unpaid invoices. */
  outstandingInvoices: number;
  /** SKUs below reorder threshold. */
  lowStock: number;
  /** Change in low-stock count since yesterday. */
  lowStockDelta: number;
  /** 7-day cashflow series (RM 100 units). */
  cashflow: { day: string; inflow: number; outflow: number }[];
  /** Finance pillar tile metric. */
  financeMtd: number;
  /** Operations pillar tile metric. */
  opsBacklog: number;
  /** Operations SLA risk count. */
  opsAtRisk: number;
  /** Sales pillar tile metric. */
  salesTickets: number;
  /** Sales today total. */
  salesToday: number;
  /** HR headcount. */
  hrHeadcount: number;
  /** HR pending leave count. */
  hrPendingLeave: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function getDemoFigures(businessId: string): DemoFigures {
  const seed = businessId || "anonymous";

  const revenueMtd = pickInt(seed, "revenue", 32000, 78000);
  const revenueGrowthPct =
    Math.round(pick(seed, "growth", -5, 22) * 10) / 10;
  const outstanding = pickInt(seed, "ar", 4200, 18500);
  const outstandingInvoices = pickInt(seed, "ar-count", 2, 9);
  const lowStock = pickInt(seed, "stock", 3, 14);
  const lowStockDelta = pickInt(seed, "stock-delta", -5, 4);

  const cashflow = WEEKDAYS.map((day, i) => {
    const inflow = pickInt(seed, `cf-in-${i}`, 38, 120);
    const outflow = pickInt(seed, `cf-out-${i}`, 18, 56);
    return { day, inflow, outflow };
  });

  return {
    revenueMtd,
    revenueGrowthPct,
    outstanding,
    outstandingInvoices,
    lowStock,
    lowStockDelta,
    cashflow,
    financeMtd: revenueMtd, // same source of truth
    opsBacklog: pickInt(seed, "ops", 12, 38),
    opsAtRisk: pickInt(seed, "ops-risk", 0, 9),
    salesTickets: pickInt(seed, "sales", 460, 1880),
    salesToday: pickInt(seed, "sales-today", 6200, 18900),
    hrHeadcount: pickInt(seed, "hr", 4, 22),
    hrPendingLeave: pickInt(seed, "hr-leave", 0, 4),
  };
}

export interface DemoChannelRow {
  channel: "tiktok" | "instagram" | "facebook" | "whatsapp";
  reach: string;
  engagement: string;
  posts: number;
  fill: number;
}

export function getDemoChannelMix(businessId: string): DemoChannelRow[] {
  const seed = businessId || "anonymous";
  const channels: DemoChannelRow["channel"][] = [
    "tiktok",
    "instagram",
    "facebook",
    "whatsapp",
  ];
  return channels.map((channel, i) => {
    const reachNum = pickInt(seed, `reach-${channel}`, 1200, 28000);
    const engageNum =
      Math.round(pick(seed, `engage-${channel}`, 0.8, 8.4) * 10) / 10;
    return {
      channel,
      reach: formatThousands(reachNum),
      engagement: `${engageNum}%`,
      posts: pickInt(seed, `posts-${channel}`, 1, 7),
      fill: Math.min(100, Math.round(40 + i * 12 + pick(seed, `fill-${i}`, -8, 12))),
    };
  });
}

export interface DemoPost {
  id: string;
  channel: "tiktok" | "instagram" | "facebook";
  title: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
}

const POST_TITLES = [
  "Hari Raya menu reveal",
  "Behind-the-scenes kedai",
  "Promo Jumaat 20% off",
  "Customer review highlight",
  "Open-kitchen Wednesday",
  "Bundle deal launch",
  "New chef's special",
  "Loyalty programme teaser",
];

export function getDemoTopPosts(
  businessId: string,
  limit = 4,
): DemoPost[] {
  const seed = businessId || "anonymous";
  const channels: DemoPost["channel"][] = ["tiktok", "instagram", "facebook"];
  return Array.from({ length: limit }, (_, i) => {
    const titleIndex =
      (hash32(`${seed}-title-${i}`) >>> 0) % POST_TITLES.length;
    const channel = channels[(hash32(`${seed}-ch-${i}`) >>> 0) % channels.length];
    const views = pickInt(seed, `views-${i}`, 1800, 24000);
    return {
      id: `demo-${i}-${seed.slice(0, 4)}`,
      channel,
      title: POST_TITLES[titleIndex],
      views: formatThousands(views),
      likes: formatThousands(Math.round(views * pick(seed, `likes-${i}`, 0.04, 0.09))),
      comments: String(pickInt(seed, `comments-${i}`, 8, 110)),
      shares: String(pickInt(seed, `shares-${i}`, 14, 240)),
    };
  });
}

export interface DemoActivityRow {
  id: string;
  kind: "invoice_paid" | "pos_sale" | "low_stock";
  title: string;
  subtitle: string;
  amount: string;
}

export function getDemoActivity(
  businessId: string,
  count = 3,
): DemoActivityRow[] {
  const seed = businessId || "anonymous";
  const counterparts = [
    "Lapan Holdings",
    "Aiman Trading",
    "Berkat Mart",
    "Sara Bistro",
    "Hartanah Utara",
    "Studio Kreatif",
  ];
  const skus = [
    "Beras 5kg",
    "Minyak masak 2L",
    "Gula halus 1kg",
    "Sambal kicap 250ml",
    "Roti canai frozen",
  ];

  const rows: DemoActivityRow[] = [
    {
      id: `act-1-${seed.slice(0, 4)}`,
      kind: "invoice_paid",
      title: `INV-2026-${String(pickInt(seed, "inv-num", 100, 980)).padStart(4, "0")} paid`,
      subtitle: `${counterparts[pickInt(seed, "cp-1", 0, counterparts.length - 1)]} · ${pickInt(seed, "ago-1", 2, 28)} min ago`,
      amount: `RM ${formatThousands(pickInt(seed, "inv-amt", 480, 5800))}`,
    },
    {
      id: `act-2-${seed.slice(0, 4)}`,
      kind: "pos_sale",
      title: `New POS sale — RM ${pickInt(seed, "pos", 42, 380)}`,
      subtitle: `Walk-in · ${pickInt(seed, "ago-2", 5, 55)} min ago`,
      amount: "POS",
    },
    {
      id: `act-3-${seed.slice(0, 4)}`,
      kind: "low_stock",
      title: `Low stock — ${skus[pickInt(seed, "sku", 0, skus.length - 1)]}`,
      subtitle: `Reorder triggered · ${pickInt(seed, "ago-3", 1, 6)} hr ago`,
      amount: "Reorder",
    },
  ];
  return rows.slice(0, count);
}

function formatThousands(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(k < 10 ? 1 : 0)}K`;
  }
  return new Intl.NumberFormat("en-MY").format(n);
}

export function formatMyrAmount(amount: number): string {
  return new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
