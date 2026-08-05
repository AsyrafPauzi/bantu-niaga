import "server-only";

import { postBusinessNotification } from "@/lib/notifications/post";
import { orderStatusLabel } from "@/lib/operations/schemas";

function postOperations(
  businessId: string,
  eventType: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  void postBusinessNotification({
    businessId,
    pillar: "operations",
    eventType,
    message,
    meta,
  });
}

export function notifyOperationsOrderCreated(input: {
  businessId: string;
  orderId: string;
  number: string;
  title: string;
  customerName: string;
}): void {
  postOperations(
    input.businessId,
    "operations.order.created",
    `Order ${input.number}: ${input.title} for ${input.customerName}`,
    { order_id: input.orderId },
  );
}

export function notifyOperationsOrderStatusChanged(input: {
  businessId: string;
  orderId: string;
  number: string;
  title: string;
  status: string;
}): void {
  postOperations(
    input.businessId,
    "operations.order.status_changed",
    `Order ${input.number} (${input.title}) → ${orderStatusLabel(input.status as "todo" | "in_progress" | "ready" | "done")}`,
    { order_id: input.orderId, status: input.status },
  );
}

export function notifyOperationsOrderDeleted(input: {
  businessId: string;
  orderId: string;
  number: string;
}): void {
  postOperations(
    input.businessId,
    "operations.order.deleted",
    `Order ${input.number} removed`,
    { order_id: input.orderId },
  );
}

export function notifyOperationsBookingCreated(input: {
  businessId: string;
  bookingId: string;
  number: string;
  serviceTitle: string;
  customerName: string;
}): void {
  postOperations(
    input.businessId,
    "operations.booking.created",
    `Booking ${input.number}: ${input.serviceTitle} for ${input.customerName}`,
    { booking_id: input.bookingId },
  );
}

export function notifyOperationsBookingStatusChanged(input: {
  businessId: string;
  bookingId: string;
  number: string;
  serviceTitle: string;
  status: string;
}): void {
  postOperations(
    input.businessId,
    "operations.booking.status_changed",
    `Booking ${input.number} (${input.serviceTitle}) → ${input.status}`,
    { booking_id: input.bookingId, status: input.status },
  );
}

export function notifyOperationsProductCreated(input: {
  businessId: string;
  productId: string;
  sku: string;
  name: string;
}): void {
  postOperations(
    input.businessId,
    "operations.product.created",
    `Product added: ${input.name} (${input.sku})`,
    { product_id: input.productId },
  );
}

export function notifyOperationsProductLowStock(input: {
  businessId: string;
  productId: string;
  sku: string;
  name: string;
  stockQty: number;
}): void {
  postOperations(
    input.businessId,
    "operations.product.low_stock",
    `Low stock: ${input.name} (${input.sku}) — ${input.stockQty} left`,
    { product_id: input.productId, stock_qty: input.stockQty },
  );
}

export function notifyOperationsSupplierCreated(input: {
  businessId: string;
  supplierId: string;
  name: string;
}): void {
  postOperations(
    input.businessId,
    "operations.supplier.created",
    `Supplier added: ${input.name}`,
    { supplier_id: input.supplierId },
  );
}

export function notifyOperationsExportDownloaded(input: {
  businessId: string;
}): void {
  postOperations(
    input.businessId,
    "operations.export.downloaded",
    "Operations data export downloaded",
    {},
  );
}
