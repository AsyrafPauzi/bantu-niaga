import "server-only";

import { formatMyr } from "@/lib/marketing/metrics";
import { postBusinessNotification } from "@/lib/notifications/post";

function postSales(
  businessId: string,
  eventType: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  void postBusinessNotification({
    businessId,
    pillar: "sales",
    eventType,
    message,
    meta,
  });
}

export function notifySalesLeadCreated(input: {
  businessId: string;
  leadId: string;
  name: string;
}): void {
  postSales(
    input.businessId,
    "sales.lead.created",
    `Lead added: ${input.name}`,
    { lead_id: input.leadId },
  );
}

export function notifySalesLeadConverted(input: {
  businessId: string;
  leadId: string;
  name: string;
  customerId: string;
}): void {
  postSales(
    input.businessId,
    "sales.lead.converted",
    `Lead converted: ${input.name} → CRM customer`,
    { lead_id: input.leadId, customer_id: input.customerId },
  );
}

export function notifySalesPosCompleted(input: {
  businessId: string;
  saleId: string;
  saleNumber: string;
  totalMyr: number;
  paymentMethod: string;
}): void {
  const pay =
    input.paymentMethod === "cash"
      ? "Cash"
      : input.paymentMethod === "duitnow_qr_static"
        ? "DuitNow QR"
        : input.paymentMethod;
  postSales(
    input.businessId,
    "sales.pos.completed",
    `POS sale ${input.saleNumber}: ${formatMyr(input.totalMyr)} (${pay})`,
    { sale_id: input.saleId },
  );
}

export function notifySalesPosVoided(input: {
  businessId: string;
  saleId: string;
  saleNumber: string;
}): void {
  postSales(
    input.businessId,
    "sales.pos.voided",
    `POS sale voided: ${input.saleNumber}`,
    { sale_id: input.saleId },
  );
}

export function notifySalesExportDownloaded(input: {
  businessId: string;
}): void {
  postSales(
    input.businessId,
    "sales.export.downloaded",
    "Sales export downloaded",
    {},
  );
}
