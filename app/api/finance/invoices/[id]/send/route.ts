import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadInvoiceWithItems } from "@/lib/finance/invoice-db";
import { renderFinanceInvoicePdf } from "@/lib/finance/invoice-pdf";
import {
  buildInvoiceShareMessage,
  invoiceShareUrl,
} from "@/lib/finance/schemas";
import { sendEmail } from "@/lib/marketing/email-resend";
import { loadBusiness } from "@/lib/settings/business";
import {
  notifyFinanceInvoiceEmailed,
  notifyFinanceInvoiceSent,
} from "@/lib/finance/notify";
import {
  incrementFreeTierEmailUsage,
  isFreeTierLimitError,
} from "@/lib/settings/free-tier-limits";
import { loadBusinessTier } from "@/lib/settings/load-business-tier";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Sign in required." } },
        { status: 401 },
      );
    }
    throw e;
  }

  if (!can(user.role, "finance")) {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "Finance access denied." } },
      { status: 403 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const fromEmail = process.env.MARKETING_FROM_EMAIL?.trim() ?? "";
  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "email_channel_not_configured",
          message:
            "Email is not configured on the platform. Set RESEND_API_KEY and MARKETING_FROM_EMAIL.",
        },
      },
      { status: 412 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const invoice = await loadInvoiceWithItems(supabase, user.businessId, id);
  if (!invoice) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Invoice not found." } },
      { status: 404 },
    );
  }

  if (!invoice.customer_email?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "customer_email_required",
          message: "Add a customer email before sending.",
        },
      },
      { status: 400 },
    );
  }

  if (invoice.status === "void") {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_status", message: "Cannot email a void invoice." },
      },
      { status: 400 },
    );
  }

  const business = await loadBusiness(user.businessId);
  if (!business) {
    return NextResponse.json(
      { ok: false, error: { code: "business_not_found", message: "Business not found." } },
      { status: 500 },
    );
  }

  const tier = await loadBusinessTier(user.businessId, supabase);
  try {
    await incrementFreeTierEmailUsage(supabase, user.businessId, tier);
  } catch (e) {
    if (isFreeTierLimitError(e)) {
      return NextResponse.json(
        { ok: false, error: e.payload },
        { status: 403 },
      );
    }
    throw e;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const shareUrl = appUrl
    ? invoiceShareUrl(appUrl, business.idcompany, invoice.share_hash)
    : "";
  const message = buildInvoiceShareMessage(
    business.name,
    invoice.number,
    Number(invoice.total_myr),
    shareUrl,
  );

  const pdfBytes = await renderFinanceInvoicePdf(invoice, business);
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
  const filename = `${invoice.number.replace(/[^\w-]+/g, "-")}.pdf`;

  const fromName = business.email_from_name?.trim() || business.name;
  const result = await sendEmail({
    to: invoice.customer_email.trim(),
    subject: `Invoice ${invoice.number} from ${business.name}`,
    body: `${message}\n\nPDF attached. You can also view online: ${shareUrl || "(link unavailable)"}`,
    fromEmail: `${fromName} <${fromEmail}>`,
    apiKey,
    attachments: [{ filename, content: pdfBase64 }],
  });

  if (!result.ok) {
    if (result.reason === "email_channel_not_configured") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "email_channel_not_configured",
            message: "Email channel is not configured.",
          },
        },
        { status: 412 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "email_send_failed",
          message: result.message ?? "Could not send email.",
        },
      },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { sent_at: now };
  if (invoice.status === "draft") patch.status = "sent";

  await supabase
    .from("finance_invoices")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "finance.invoice.email",
    entity_type: "finance_invoice",
    entity_id: id,
    diff: { to: invoice.customer_email, resend_id: result.id ?? null },
  });

  const wasDraft = invoice.status === "draft";
  notifyFinanceInvoiceEmailed({
    businessId: user.businessId,
    invoiceId: id,
    number: invoice.number,
    email: invoice.customer_email.trim(),
  });
  if (wasDraft) {
    notifyFinanceInvoiceSent({
      businessId: user.businessId,
      invoiceId: id,
      number: invoice.number,
      customerName: invoice.customer_name,
      totalMyr: Number(invoice.total_myr),
    });
  }

  return NextResponse.json(
    {
      ok: true,
      data: { email_id: result.id ?? null, sent_at: now },
    },
    { status: 200 },
  );
}
