import "server-only";

import { OPERATIONS_ORDER_STATUSES } from "@/lib/operations/schemas";

export function sanitizeLike(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Models often pass SKUs or order numbers in *_id fields — remap before Zod parse. */
export function normalizeOperationsToolArgs(
  name: string,
  args: unknown,
): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return {};
  }
  const record = { ...(args as Record<string, unknown>) };

  const coerceNonUuid = (idField: string, altField: string) => {
    const value = record[idField];
    if (typeof value === "string" && value.trim() && !isUuid(value)) {
      if (!record[altField]) record[altField] = value.trim();
      delete record[idField];
    }
  };

  switch (name) {
    case "adjust_stock":
      coerceNonUuid("product_id", "sku");
      break;
    case "update_product":
      coerceNonUuid("product_id", "lookup_sku");
      break;
    case "update_service":
      coerceNonUuid("service_id", "service_name");
      break;
    case "update_order_status":
      coerceNonUuid("order_id", "order_number");
      break;
    case "update_booking_status":
      coerceNonUuid("booking_id", "booking_number");
      break;
    case "get_order":
      coerceNonUuid("order_id", "order_number");
      break;
    case "get_booking":
      coerceNonUuid("booking_id", "customer_name");
      break;
    case "get_supplier":
      coerceNonUuid("supplier_id", "supplier_name");
      break;
    case "create_booking":
      if (
        typeof record.service_id === "string" &&
        record.service_id.trim() &&
        !isUuid(record.service_id)
      ) {
        if (!record.service_title) {
          record.service_title = record.service_id.trim();
        }
        delete record.service_id;
      }
      if (
        typeof record.resource_id === "string" &&
        record.resource_id.trim() &&
        !isUuid(record.resource_id)
      ) {
        delete record.resource_id;
      }
      break;
    default:
      break;
  }

  return record;
}

const ACTION_TOOLS = new Set([
  "create_order",
  "update_order_status",
  "create_booking",
  "update_booking_status",
  "adjust_stock",
  "create_product",
  "create_service",
  "create_supplier",
  "update_product",
  "update_service",
]);

export function isOperationsActionTool(name: string): boolean {
  return ACTION_TOOLS.has(name);
}

export const OPERATIONS_ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_operations_overview",
      description:
        "Summary counts: open orders, overdue, bookings, low stock, done this month.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_today_briefing",
      description:
        "Today's ops digest: overdue orders, bookings today, low-stock products, supplier count.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_orders",
      description: "List orders with optional status or overdue filter.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: [...OPERATIONS_ORDER_STATUSES] },
          overdue_only: { type: "boolean" },
          customer_name: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_bookings",
      description: "List upcoming or recent bookings.",
      parameters: {
        type: "object",
        properties: {
          upcoming_only: { type: "boolean" },
          days_ahead: { type: "number" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_products",
      description: "List products; optionally low stock only.",
      parameters: {
        type: "object",
        properties: {
          low_stock_only: { type: "boolean" },
          q: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_order_status",
      description: "Move an order to todo, in_progress, ready, or done.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          order_number: { type: "string" },
          status: { type: "string", enum: [...OPERATIONS_ORDER_STATUSES] },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_order",
      description: "Create a new customer order on the board.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_phone: { type: "string" },
          title: { type: "string" },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          amount_myr: { type: "number" },
          notes: { type: "string" },
        },
        required: ["customer_name", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_suppliers",
      description: "List supplier contacts.",
      parameters: {
        type: "object",
        properties: { q: { type: "string" }, limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_services",
      description: "List bookable services from the catalogue.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_booking_resources",
      description: "List bookable resources (rooms, chairs, staff slots).",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "adjust_stock",
      description:
        "Set product stock quantity. Use sku for catalog codes (e.g. SNACK-KUIH); product_id only when you have a UUID from list_products.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          sku: { type: "string" },
          stock_qty: { type: "number" },
        },
        required: ["stock_qty"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_product",
      description:
        "Add a product to the catalog. Requires unique sku and name; set stock_qty when tracking inventory.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          price_myr: { type: "number" },
          stock_qty: { type: "number" },
          low_stock_threshold: { type: "number" },
          description: { type: "string" },
          notes: { type: "string" },
        },
        required: ["sku", "name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_service",
      description:
        "Add a bookable service to the catalogue. Sets duration and default price for bookings.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          duration_minutes: { type: "number" },
          price_myr: { type: "number" },
          description: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_supplier",
      description:
        "Add a supplier contact for restock and purchase orders. Requires name; phone and payment terms help later.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          contact_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          payment_terms: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_product",
      description:
        "Update a catalog product. Identify by product_id (UUID) or lookup_sku; pass fields to change (name, price, stock, category, is_active).",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          lookup_sku: { type: "string" },
          sku: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          price_myr: { type: "number" },
          stock_qty: { type: "number" },
          low_stock_threshold: { type: "number" },
          description: { type: "string" },
          notes: { type: "string" },
          is_active: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_service",
      description:
        "Update a bookable service. Identify by service_id (UUID) or service_name; pass fields to change.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string" },
          service_name: { type: "string" },
          name: { type: "string" },
          duration_minutes: { type: "number" },
          price_myr: { type: "number" },
          description: { type: "string" },
          notes: { type: "string" },
          is_active: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_booking",
      description:
        "Create a customer booking. Prefer service_id for auto duration/price; pass resource_id to check conflicts.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_phone: { type: "string" },
          service_id: { type: "string", description: "UUID from list_services" },
          service_title: { type: "string" },
          resource_id: { type: "string", description: "UUID from list_booking_resources" },
          starts_at: { type: "string", description: "ISO datetime" },
          ends_at: { type: "string", description: "ISO datetime (optional if service_id set)" },
          amount_myr: { type: "number" },
          notes: { type: "string" },
        },
        required: ["customer_name", "starts_at"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_booking_status",
      description: "Update booking status: held, confirmed, completed, cancelled.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string" },
          booking_number: { type: "string" },
          status: {
            type: "string",
            enum: ["held", "confirmed", "completed", "cancelled"],
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order",
      description:
        "Get full details of one order by order number or customer name. Use when the user asks about a specific order's status, items, or due date.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "UUID from list_orders" },
          order_number: { type: "string", description: "e.g. ORD-001" },
          customer_name: { type: "string", description: "Partial match" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_booking",
      description:
        "Get details of one booking by customer name or date. Use when the user asks about a specific booking.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string", description: "UUID from list_bookings" },
          customer_name: { type: "string" },
          booking_date: { type: "string", description: "YYYY-MM-DD" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_supplier",
      description:
        "Get full details of one supplier by name or ID. Use when the user asks about a supplier's contact info, products, or notes.",
      parameters: {
        type: "object",
        properties: {
          supplier_id: { type: "string", description: "UUID from list_suppliers" },
          supplier_name: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock_report",
      description:
        "Get a full stock status report showing all products, their stock levels, and which are below threshold. Use when the user wants a comprehensive stock overview.",
      parameters: {
        type: "object",
        properties: {
          low_stock_only: { type: "boolean" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

export const OPERATIONS_ASSISTANT_TOOL_NAMES = new Set(
  OPERATIONS_ASSISTANT_TOOLS.map((t) => t.function.name),
);
