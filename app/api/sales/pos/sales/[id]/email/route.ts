import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageSalesCore } from "@/lib/sales/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderNiagaXEmail } from "@/lib/email/layout";
import { sendEmail } from "@/lib/marketing/email-resend";
import { loadBusiness } from "@/lib/settings/business";
import {
  incrementFreeTierEmailUsage,
  isFreeTierLimitError,
} from "@/lib/settings/free-tier-limits";
import { loadBusinessTier } from "@/lib/settings/load-business-tier";
import {
  assertBusinessSubscriptionWritable,
  SubscriptionPastDueError,
} from "@/lib/settings/assert-business-writable";
import { pastDueJsonResponse } from "@/lib/settings/past-due-response";
import { consume, rateLimitHeaders } from "@/lib/api/rate-limit";
import { tooManyRequests } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254),
});

type RouteContext = { params: Promise<{ id: string }> };

function money(n: number) {
  return `RM ${Number(n).toFixed(2)}`;
}

/**
 * POST /api/sales/pos/sales/[id]/email
 *
 * Email a POS receipt to a customer address via Resend (platform config).
 */
export async function POST(request: Request, context: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", message: "Sign in required." },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!canManageSalesCore(user.role)) {
    return NextResponse.json(
      { error: "forbidden", message: "Sales access denied." },
      { status: 403 },
    );
  }

  const rl = consume({
    bucket: "sales.pos.email_receipt",
    identifier: `user:${user.id}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfterSeconds, {
      headers: rateLimitHeaders(rl),
    });
  }

  const supabase = await createSupabaseServerClient();
  try {
    await assertBusinessSubscriptionWritable(supabase, user.businessId);
  } catch (e) {
    if (e instanceof SubscriptionPastDueError) {
      return pastDueJsonResponse(e);
    }
    throw e;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const fromEmail = process.env.MARKETING_FROM_EMAIL?.trim() ?? "";
  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      {
        error: "email_channel_not_configured",
        message:
          "Email is not configured on the platform. Set RESEND_API_KEY and MARKETING_FROM_EMAIL.",
      },
      { status: 412, headers: rateLimitHeaders(rl) },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Expected JSON body." },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(json);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        {
          error: "validation_failed",
          message: e.issues[0]?.message ?? "Invalid email.",
          issues: e.issues,
        },
        { status: 400 },
      );
    }
    throw e;
  }

  const { id } = await context.params;

  const [saleRes, itemsRes, business] = await Promise.all([
    supabase
      .from("pos_sales")
      .select(
        "id, sale_number, subtotal_myr, discount_amount_myr, sst_amount_myr, total_myr, payment_method, payment_received_myr, change_myr, customer_name, coupon_code, status, created_at",
      )
      .eq("id", id)
      .eq("business_id", user.businessId)
      .maybeSingle(),
    supabase
      .from("pos_sale_items")
      .select("product_name, quantity, unit_price_myr, line_total_myr")
      .eq("sale_id", id)
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: true }),
    loadBusiness(user.businessId),
  ]);

  if (!saleRes.data) {
    return NextResponse.json(
      { error: "not_found", message: "Sale not found." },
      { status: 404 },
    );
  }

  const sale = saleRes.data;
  if (sale.status === "voided") {
    return NextResponse.json(
      { error: "invalid_status", message: "Cannot email a voided sale." },
      { status: 400 },
    );
  }

  if (!business) {
    return NextResponse.json(
      { error: "business_not_found", message: "Business not found." },
      { status: 500 },
    );
  }

  const tier = await loadBusinessTier(user.businessId, supabase);
  try {
    await incrementFreeTierEmailUsage(supabase, user.businessId, tier);
  } catch (e) {
    if (isFreeTierLimitError(e)) {
      return NextResponse.json(
        {
          error: e.payload.error,
          message: e.payload.message,
          limit: e.payload.limit,
        },
        { status: 403, headers: rateLimitHeaders(rl) },
      );
    }
    throw e;
  }

  const items = itemsRes.data ?? [];
  const payLabel =
    sale.payment_method === "cash"
      ? "Cash"
      : sale.payment_method === "duitnow_qr_static"
        ? "DuitNow QR"
        : sale.payment_method;

  const when = new Date(sale.created_at).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const lines = [
    `Receipt from ${business.name}`,
    `Sale ${sale.sale_number}`,
    `Date: ${when}`,
    "",
    ...items.map(
      (it) =>
        `${it.product_name} × ${it.quantity} — ${money(Number(it.line_total_myr))}`,
    ),
    "",
    `Subtotal: ${money(Number(sale.subtotal_myr))}`,
  ];
  if (Number(sale.discount_amount_myr) > 0) {
    lines.push(
      `Discount${sale.coupon_code ? ` (${sale.coupon_code})` : ""}: −${money(Number(sale.discount_amount_myr))}`,
    );
  }
  if (Number(sale.sst_amount_myr) > 0) {
    lines.push(`SST: ${money(Number(sale.sst_amount_myr))}`);
  }
  lines.push(`Total: ${money(Number(sale.total_myr))}`);
  lines.push(`Paid: ${payLabel}`);
  if (sale.customer_name?.trim()) {
    lines.push(`Customer: ${sale.customer_name.trim()}`);
  }
  if (business.receipt_footer?.trim()) {
    lines.push("", business.receipt_footer.trim());
  }

  const bodyText = lines.join("\n");
  const fromName = business.email_from_name?.trim() || business.name;
  const subject = `Receipt ${sale.sale_number} from ${business.name}`;
  const html = renderNiagaXEmail({
    locale: "en",
    brandName: business.name,
    subject,
    heading: `Receipt ${sale.sale_number}`,
    bodyText,
    footerText:
      "You received this receipt from a NiagaX customer. Bantu Niaga Sdn. Bhd.",
  });

  const result = await sendEmail({
    to: parsed.email,
    subject,
    body: bodyText,
    html,
    fromEmail: `${fromName} <${fromEmail}>`,
    apiKey,
  });

  if (!result.ok) {
    if (result.reason === "email_channel_not_configured") {
      return NextResponse.json(
        {
          error: "email_channel_not_configured",
          message: "Email channel is not configured.",
        },
        { status: 412, headers: rateLimitHeaders(rl) },
      );
    }
    return NextResponse.json(
      {
        error: "send_failed",
        message: result.message || "Could not send email.",
      },
      { status: 502, headers: rateLimitHeaders(rl) },
    );
  }

  return NextResponse.json(
    { ok: true, to: parsed.email },
    { status: 200, headers: rateLimitHeaders(rl) },
  );
}
