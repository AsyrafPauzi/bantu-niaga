import "server-only";

import { postBusinessNotification } from "@/lib/notifications/post";

function postMarketing(
  businessId: string,
  eventType: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  void postBusinessNotification({
    businessId,
    pillar: "marketing",
    eventType,
    message,
    meta,
  });
}

export function notifyMarketingCustomerCreated(input: {
  businessId: string;
  customerId: string;
  name: string;
}): void {
  postMarketing(
    input.businessId,
    "marketing.customer.created",
    `Customer added: ${input.name}`,
    { customer_id: input.customerId },
  );
}

export function notifyMarketingCouponCreated(input: {
  businessId: string;
  couponId: string;
  code: string;
}): void {
  postMarketing(
    input.businessId,
    "marketing.coupon.created",
    `Coupon created: ${input.code}`,
    { coupon_id: input.couponId },
  );
}

export function notifyMarketingBroadcastCreated(input: {
  businessId: string;
  broadcastId: string;
  title: string;
}): void {
  postMarketing(
    input.businessId,
    "marketing.broadcast.created",
    `Broadcast drafted: ${input.title}`,
    { broadcast_id: input.broadcastId },
  );
}

export function notifyMarketingBroadcastSent(input: {
  businessId: string;
  broadcastId: string;
  title: string;
  recipientCount: number;
}): void {
  postMarketing(
    input.businessId,
    "marketing.broadcast.sent",
    `Broadcast sent: ${input.title} (${input.recipientCount} recipient${input.recipientCount === 1 ? "" : "s"})`,
    { broadcast_id: input.broadcastId },
  );
}

export function notifyMarketingSegmentCreated(input: {
  businessId: string;
  segmentId: string;
  name: string;
}): void {
  postMarketing(
    input.businessId,
    "marketing.segment.created",
    `Segment created: ${input.name}`,
    { segment_id: input.segmentId },
  );
}

export function notifyMarketingCsvImportCommitted(input: {
  businessId: string;
  importId: string;
  rowCount: number;
}): void {
  postMarketing(
    input.businessId,
    "marketing.csv_import.committed",
    `CSV import completed — ${input.rowCount} customer${input.rowCount === 1 ? "" : "s"}`,
    { import_id: input.importId },
  );
}
