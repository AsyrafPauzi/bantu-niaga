import { describe, expect, it } from "vitest";
import {
  isOperationsActionTool,
  normalizeOperationsToolArgs,
} from "@/lib/ai/operations-assistant-tools";

describe("operations-assistant-tools", () => {
  it("classifies write tools as actions", () => {
    expect(isOperationsActionTool("create_order")).toBe(true);
    expect(isOperationsActionTool("update_order_status")).toBe(true);
    expect(isOperationsActionTool("create_booking")).toBe(true);
    expect(isOperationsActionTool("update_booking_status")).toBe(true);
    expect(isOperationsActionTool("adjust_stock")).toBe(true);
    expect(isOperationsActionTool("create_product")).toBe(true);
    expect(isOperationsActionTool("create_service")).toBe(true);
    expect(isOperationsActionTool("create_supplier")).toBe(true);
    expect(isOperationsActionTool("update_product")).toBe(true);
    expect(isOperationsActionTool("update_service")).toBe(true);
  });

  it("does not classify read tools as actions", () => {
    expect(isOperationsActionTool("get_operations_overview")).toBe(false);
    expect(isOperationsActionTool("get_today_briefing")).toBe(false);
    expect(isOperationsActionTool("list_orders")).toBe(false);
    expect(isOperationsActionTool("list_booking_resources")).toBe(false);
    expect(isOperationsActionTool("list_suppliers")).toBe(false);
    expect(isOperationsActionTool("list_services")).toBe(false);
    expect(isOperationsActionTool("unknown")).toBe(false);
  });

  it("remaps SKU passed as product_id for adjust_stock", () => {
    const out = normalizeOperationsToolArgs("adjust_stock", {
      product_id: "SNACK-KUIH",
      stock_qty: 10,
    });
    expect(out.product_id).toBeUndefined();
    expect(out.sku).toBe("SNACK-KUIH");
    expect(out.stock_qty).toBe(10);
  });

  it("remaps order number passed as order_id", () => {
    const out = normalizeOperationsToolArgs("update_order_status", {
      order_id: "ORD-0042",
      status: "done",
    });
    expect(out.order_id).toBeUndefined();
    expect(out.order_number).toBe("ORD-0042");
  });

  it("remaps SKU passed as product_id for update_product", () => {
    const out = normalizeOperationsToolArgs("update_product", {
      product_id: "SNACK-KUIH",
      price_myr: 12,
    });
    expect(out.product_id).toBeUndefined();
    expect(out.lookup_sku).toBe("SNACK-KUIH");
    expect(out.price_myr).toBe(12);
  });

  it("remaps service title passed as service_id for update_service", () => {
    const out = normalizeOperationsToolArgs("update_service", {
      service_id: "Haircut",
      price_myr: 45,
    });
    expect(out.service_id).toBeUndefined();
    expect(out.service_name).toBe("Haircut");
    expect(out.price_myr).toBe(45);
  });
});
