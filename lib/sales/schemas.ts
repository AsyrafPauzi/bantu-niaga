import { z } from "zod";

export const posCheckoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().finite().positive().max(9999),
});

export const posCheckoutSchema = z
  .object({
    items: z.array(posCheckoutItemSchema).min(1).max(100),
    payment_method: z.enum(["cash", "duitnow_qr_static"]),
    discount_type: z.enum(["amount", "pct"]).nullable().optional(),
    discount_value: z.number().finite().nonnegative().nullable().optional(),
    payment_received_myr: z.number().finite().nonnegative().nullable().optional(),
    payment_note: z.string().trim().max(500).nullable().optional(),
    customer_id: z.string().uuid().nullable().optional(),
    customer_name: z.string().trim().max(200).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.discount_type && (v.discount_value === null || v.discount_value === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "discount_value required when discount_type is set",
        path: ["discount_value"],
      });
    }
    if (v.discount_type === "pct" && (v.discount_value ?? 0) > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "percent discount cannot exceed 100",
        path: ["discount_value"],
      });
    }
  });

export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>;

export function computePosTotals(opts: {
  lineSubtotal: number;
  discountType: "amount" | "pct" | null | undefined;
  discountValue: number | null | undefined;
  sstEnabled: boolean;
  sstRatePct: number;
}): {
  subtotal_myr: number;
  discount_amount_myr: number;
  sst_amount_myr: number;
  total_myr: number;
} {
  const subtotal = Math.max(0, Number(opts.lineSubtotal.toFixed(2)));
  let discount = 0;
  if (opts.discountType === "amount" && opts.discountValue != null) {
    discount = Math.min(subtotal, opts.discountValue);
  } else if (opts.discountType === "pct" && opts.discountValue != null) {
    discount = Math.min(subtotal, (subtotal * opts.discountValue) / 100);
  }
  discount = Number(discount.toFixed(2));
  const afterDiscount = Number((subtotal - discount).toFixed(2));
  const sst = opts.sstEnabled
    ? Number(((afterDiscount * (opts.sstRatePct || 0)) / 100).toFixed(2))
    : 0;
  const total = Number((afterDiscount + sst).toFixed(2));
  return {
    subtotal_myr: subtotal,
    discount_amount_myr: discount,
    sst_amount_myr: sst,
    total_myr: total,
  };
}

export function malaysiaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

/** Start/end of Malaysia calendar day as ISO strings for timestamptz filters. */
export function malaysiaDayBounds(ymd: string = malaysiaTodayYmd()): {
  dayStartIso: string;
  dayEndIso: string;
} {
  const dayStartIso = `${ymd}T00:00:00.000+08:00`;
  const end = new Date(dayStartIso);
  end.setDate(end.getDate() + 1);
  return { dayStartIso, dayEndIso: end.toISOString() };
}

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "interested",
  "won",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_CHANNELS = [
  "whatsapp",
  "instagram",
  "referral",
  "walk_in",
  "call",
  "other",
] as const;

export type LeadChannel = (typeof LEAD_CHANNELS)[number];

/** Accept ISO datetime or YYYY-MM-DD (Malaysia morning). */
const followUpAtSchema = z
  .union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.null(),
  ])
  .optional();

export function normalizeFollowUpAt(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T09:00:00.000+08:00`;
  }
  return value;
}

export const leadCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40),
  channel: z.enum(LEAD_CHANNELS).nullable().optional(),
  interest: z.string().trim().max(500).nullable().optional(),
  estimated_value_myr: z.number().finite().nonnegative().nullable().optional(),
  follow_up_at: followUpAtSchema,
  assigned_to: z.string().uuid().nullable().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

export const leadUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(1).max(40).optional(),
    channel: z.enum(LEAD_CHANNELS).nullable().optional(),
    interest: z.string().trim().max(500).nullable().optional(),
    estimated_value_myr: z.number().finite().nonnegative().nullable().optional(),
    status: z.enum(LEAD_STATUSES).optional(),
    follow_up_at: followUpAtSchema,
    assigned_to: z.string().uuid().nullable().optional(),
    lost_reason: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const leadNoteCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export type LeadNoteCreateInput = z.infer<typeof leadNoteCreateSchema>;
