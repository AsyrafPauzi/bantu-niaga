import "server-only";

import { z, ZodError } from "zod";
import type { AgentContext } from "@/lib/ai/context/types";
import { malaysiaTodayIso } from "@/lib/ai/malaysia-today";
import {
  OPERATIONS_ASSISTANT_TOOL_NAMES,
  normalizeOperationsToolArgs,
  sanitizeLike,
} from "@/lib/ai/operations-assistant-tool-definitions";
import {
  computeOperationsSummary,
  nextOperationsBookingNumber,
  nextOperationsOrderNumber,
} from "@/lib/operations/helpers";
import { findBookingConflicts } from "@/lib/operations/booking-buffer";
import {
  OPERATIONS_ORDER_STATUSES,
  operationsBookingUpdateSchema,
  operationsOrderCreateSchema,
  operationsOrderUpdateSchema,
  operationsProductCreateSchema,
  operationsProductUpdateSchema,
  operationsServiceCreateSchema,
  operationsServiceUpdateSchema,
  operationsSupplierCreateSchema,
  type OperationsOrderStatus,
} from "@/lib/operations/schemas";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const listOrdersSchema = z.object({
  status: z.enum(OPERATIONS_ORDER_STATUSES).optional(),
  overdue_only: z.boolean().optional(),
  customer_name: z.string().trim().optional(),
  limit: z.number().int().min(1).max(25).optional().default(10),
});

const listBookingsSchema = z.object({
  upcoming_only: z.boolean().optional().default(true),
  days_ahead: z.number().int().min(1).max(30).optional().default(7),
  limit: z.number().int().min(1).max(25).optional().default(10),
});

const listProductsSchema = z.object({
  low_stock_only: z.boolean().optional(),
  q: z.string().trim().optional(),
  limit: z.number().int().min(1).max(25).optional().default(15),
});

const updateOrderSchema = z.object({
  order_id: z.string().uuid().optional(),
  order_number: z.string().trim().optional(),
  status: z.enum(OPERATIONS_ORDER_STATUSES),
});

const createOrderToolSchema = operationsOrderCreateSchema.pick({
  customer_name: true,
  customer_phone: true,
  title: true,
  due_date: true,
  amount_myr: true,
  notes: true,
});

const createProductToolSchema = operationsProductCreateSchema.omit({
  image_file_id: true,
  is_active: true,
});

const createServiceToolSchema = operationsServiceCreateSchema.omit({
  image_file_id: true,
  is_active: true,
});

const createSupplierToolSchema = operationsSupplierCreateSchema.omit({
  admin_file_id: true,
});

const updateProductToolSchema = operationsProductUpdateSchema
  .extend({
    product_id: z.string().uuid().optional(),
    lookup_sku: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.product_id || v.lookup_sku), {
    message: "product_id or lookup_sku is required.",
    path: ["lookup_sku"],
  })
  .refine(
    (v) => {
      const { product_id: _pid, lookup_sku: _sku, ...rest } = v;
      return Object.values(rest).some((value) => value !== undefined);
    },
    { message: "At least one field to update is required.", path: ["name"] },
  );

const updateServiceToolSchema = operationsServiceUpdateSchema
  .extend({
    service_id: z.string().uuid().optional(),
    service_name: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.service_id || v.service_name), {
    message: "service_id or service_name is required.",
    path: ["service_name"],
  })
  .refine(
    (v) => {
      const { service_id: _sid, service_name: _name, ...rest } = v;
      return Object.values(rest).some((value) => value !== undefined);
    },
    { message: "At least one field to update is required.", path: ["name"] },
  );

const createBookingToolSchema = z
  .object({
    customer_name: z.string().trim().min(1).max(200),
    customer_phone: z.string().trim().max(40).optional().nullable(),
    service_id: z.string().uuid().optional(),
    service_title: z.string().trim().min(1).max(300).optional(),
    resource_id: z.string().uuid().optional().nullable(),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().optional(),
    amount_myr: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict()
  .refine((v) => Boolean(v.service_id || v.service_title), {
    message: "service_id or service_title is required.",
    path: ["service_title"],
  })
  .refine((v) => Boolean(v.ends_at || v.service_id), {
    message: "ends_at or service_id is required.",
    path: ["ends_at"],
  });

const adjustStockSchema = z.object({
  product_id: z.string().uuid().optional(),
  sku: z.string().trim().optional(),
  stock_qty: z.coerce.number().int().min(0),
});

const updateBookingSchema = z.object({
  booking_id: z.string().uuid().optional(),
  booking_number: z.string().trim().optional(),
  status: z.enum(["held", "confirmed", "completed", "cancelled"]),
});

async function findOrder(
  admin: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  opts: { order_id?: string; order_number?: string },
) {
  if (opts.order_id) {
    const { data } = await admin
      .from("operations_orders")
      .select("id, number, customer_name, title, status, due_date, amount_myr")
      .eq("business_id", businessId)
      .eq("id", opts.order_id)
      .is("deleted_at", null)
      .maybeSingle();
    return data;
  }
  if (opts.order_number) {
    const safe = sanitizeLike(opts.order_number);
    const { data } = await admin
      .from("operations_orders")
      .select("id, number, customer_name, title, status, due_date, amount_myr")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .ilike("number", `%${safe}%`)
      .limit(5);
    if (!data?.length) return null;
    if (data.length > 1) {
      return {
        ambiguous: true,
        matches: data.map((d) => ({
          id: d.id as string,
          label: `${d.number} · ${d.customer_name}`,
        })),
      };
    }
    return data[0];
  }
  return null;
}

async function findProduct(
  admin: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  opts: { product_id?: string; lookup_sku?: string },
) {
  if (opts.product_id) {
    const { data } = await admin
      .from("operations_products")
      .select("id, sku, name, price_myr, stock_qty, is_active")
      .eq("business_id", businessId)
      .eq("id", opts.product_id)
      .is("deleted_at", null)
      .maybeSingle();
    return data;
  }
  if (opts.lookup_sku) {
    const { data } = await admin
      .from("operations_products")
      .select("id, sku, name, price_myr, stock_qty, is_active")
      .eq("business_id", businessId)
      .eq("sku", opts.lookup_sku)
      .is("deleted_at", null)
      .maybeSingle();
    return data;
  }
  return null;
}

async function findService(
  admin: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  opts: { service_id?: string; service_name?: string },
) {
  if (opts.service_id) {
    const { data } = await admin
      .from("operations_services")
      .select("id, name, duration_minutes, price_myr, is_active")
      .eq("business_id", businessId)
      .eq("id", opts.service_id)
      .is("deleted_at", null)
      .maybeSingle();
    return data;
  }
  if (opts.service_name) {
    const safe = sanitizeLike(opts.service_name);
    const { data } = await admin
      .from("operations_services")
      .select("id, name, duration_minutes, price_myr, is_active")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .ilike("name", `%${safe}%`)
      .limit(5);
    if (!data?.length) return null;
    if (data.length > 1) {
      return {
        ambiguous: true,
        matches: data.map((d) => ({
          id: d.id as string,
          label: d.name as string,
        })),
      };
    }
    return data[0];
  }
  return null;
}

export async function executeOperationsAssistantTool(
  ctx: AgentContext,
  name: string,
  args: unknown,
): Promise<Record<string, unknown>> {
  if (!(OPERATIONS_ASSISTANT_TOOL_NAMES as Set<string>).has(name)) {
    return { ok: false, error: "unknown_tool" };
  }

  const admin = createServiceRoleClient();
  const businessId = ctx.businessId;
  const userId = ctx.userId;
  const today = malaysiaTodayIso();
  const toolArgs = normalizeOperationsToolArgs(name, args);

  try {
  switch (name) {
    case "get_operations_overview": {
      const summary = await computeOperationsSummary(admin, businessId);
      return { ok: true, summary };
    }

    case "get_today_briefing": {
      const summary = await computeOperationsSummary(admin, businessId);
      const dayStart = new Date(`${today}T00:00:00+08:00`);
      const dayEnd = new Date(`${today}T23:59:59+08:00`);

      const [overdueRes, todayBookingsRes, lowStockRes, suppliersRes] =
        await Promise.all([
          admin
            .from("operations_orders")
            .select("id, number, customer_name, title, due_date, status")
            .eq("business_id", businessId)
            .is("deleted_at", null)
            .neq("status", "done")
            .not("due_date", "is", null)
            .lt("due_date", today)
            .order("due_date", { ascending: true })
            .limit(8),
          admin
            .from("operations_bookings")
            .select(
              "id, number, customer_name, service_title, starts_at, ends_at, status",
            )
            .eq("business_id", businessId)
            .is("deleted_at", null)
            .gte("starts_at", dayStart.toISOString())
            .lte("starts_at", dayEnd.toISOString())
            .in("status", ["held", "confirmed"])
            .order("starts_at", { ascending: true })
            .limit(12),
          admin
            .from("operations_products")
            .select("id, sku, name, stock_qty, low_stock_threshold")
            .eq("business_id", businessId)
            .is("deleted_at", null)
            .eq("is_active", true)
            .not("stock_qty", "is", null)
            .order("name", { ascending: true })
            .limit(40),
          admin
            .from("operations_suppliers")
            .select("id, name, phone, payment_terms")
            .eq("business_id", businessId)
            .is("deleted_at", null)
            .order("name", { ascending: true })
            .limit(5),
        ]);

      const lowStock = (lowStockRes.data ?? []).filter((row) => {
        const qty = row.stock_qty as number;
        const threshold = (row.low_stock_threshold as number) ?? 5;
        return qty <= threshold;
      });

      return {
        ok: true,
        date: today,
        summary,
        overdue_orders: overdueRes.data ?? [],
        bookings_today: todayBookingsRes.data ?? [],
        low_stock_products: lowStock.slice(0, 8),
        supplier_sample: suppliersRes.data ?? [],
      };
    }

    case "list_orders": {
      const parsed = listOrdersSchema.parse(toolArgs);
      let query = admin
        .from("operations_orders")
        .select(
          "id, number, customer_name, customer_phone, title, status, due_date, amount_myr",
        )
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(parsed.limit);

      if (parsed.status) query = query.eq("status", parsed.status);
      if (parsed.customer_name) {
        const safe = sanitizeLike(parsed.customer_name);
        query = query.ilike("customer_name", `%${safe}%`);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: "query_failed" };

      let rows = data ?? [];
      if (parsed.overdue_only) {
        rows = rows.filter(
          (r) =>
            r.status !== "done" &&
            r.due_date &&
            (r.due_date as string) < today,
        );
      }

      return { ok: true, orders: rows, count: rows.length };
    }

    case "list_bookings": {
      const parsed = listBookingsSchema.parse(toolArgs);
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + parsed.days_ahead);

      let query = admin
        .from("operations_bookings")
        .select(
          "id, number, customer_name, service_title, starts_at, ends_at, status",
        )
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true })
        .limit(parsed.limit);

      if (parsed.upcoming_only) {
        query = query
          .gte("starts_at", now.toISOString())
          .lte("starts_at", end.toISOString())
          .in("status", ["held", "confirmed"]);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: "query_failed" };
      return { ok: true, bookings: data ?? [], count: data?.length ?? 0 };
    }

    case "list_products": {
      const parsed = listProductsSchema.parse(toolArgs);
      let query = admin
        .from("operations_products")
        .select(
          "id, sku, name, category, price_myr, stock_qty, low_stock_threshold, is_active",
        )
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(parsed.limit);

      if (parsed.q) {
        const safe = sanitizeLike(parsed.q);
        query = query.or(
          `name.ilike.%${safe}%,sku.ilike.%${safe}%,category.ilike.%${safe}%`,
        );
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: "query_failed" };

      let rows = data ?? [];
      if (parsed.low_stock_only) {
        rows = rows.filter((r) => {
          if (r.stock_qty == null) return false;
          const threshold = (r.low_stock_threshold as number) ?? 5;
          return (r.stock_qty as number) <= threshold;
        });
      }

      return { ok: true, products: rows, count: rows.length };
    }

    case "update_order_status": {
      const parsed = updateOrderSchema.parse(toolArgs);
      const found = await findOrder(admin, businessId, {
        order_id: parsed.order_id,
        order_number: parsed.order_number,
      });

      if (!found) {
        return { ok: false, error: "order_not_found" };
      }
      if ("ambiguous" in found && found.ambiguous) {
        return { ok: false, error: "ambiguous", matches: found.matches };
      }

      const order = found as {
        id: string;
        number: string;
        status: OperationsOrderStatus;
      };

      const patch = operationsOrderUpdateSchema.parse({ status: parsed.status });
      const updatePayload: Record<string, unknown> = { ...patch };
      if (parsed.status === "done") {
        updatePayload.completed_at = new Date().toISOString();
      }

      const { data, error } = await admin
        .from("operations_orders")
        .update(updatePayload)
        .eq("business_id", businessId)
        .eq("id", order.id)
        .is("deleted_at", null)
        .select("id, number, status")
        .single();

      if (error || !data) {
        return { ok: false, error: "update_failed" };
      }

      return {
        ok: true,
        action: "update_order_status",
        order: data,
        link: "/operations/orders",
        message: `✅ **${data.number}** moved to **${parsed.status}**.`,
      };
    }

    case "create_order": {
      const parsed = createOrderToolSchema.parse(toolArgs);
      const number = await nextOperationsOrderNumber(admin, businessId);

      const { data, error } = await admin
        .from("operations_orders")
        .insert({
          business_id: businessId,
          number,
          customer_name: parsed.customer_name,
          customer_phone: parsed.customer_phone ?? null,
          title: parsed.title,
          due_date: parsed.due_date ?? null,
          amount_myr: parsed.amount_myr ?? null,
          notes: parsed.notes ?? null,
          fulfillment_type: "pickup",
          fulfillment_status: "pending",
          status: "todo",
          created_by: userId,
        })
        .select("id, number, customer_name, title, status")
        .single();

      if (error || !data) {
        return { ok: false, error: "create_failed" };
      }

      return {
        ok: true,
        action: "create_order",
        order: data,
        link: "/operations/orders",
        message: `✅ Order **${data.number}** created for **${data.customer_name}**.`,
      };
    }

    case "list_suppliers": {
      const parsed = z
        .object({
          q: z.string().trim().optional(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        })
        .parse(toolArgs);
      let query = admin
        .from("operations_suppliers")
        .select("id, name, contact_name, phone, email, payment_terms")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(parsed.limit);
      if (parsed.q) {
        const safe = sanitizeLike(parsed.q);
        query = query.ilike("name", `%${safe}%`);
      }
      const { data, error } = await query;
      if (error) return { ok: false, error: "query_failed" };
      return { ok: true, suppliers: data ?? [], count: data?.length ?? 0 };
    }

    case "list_services": {
      const parsed = z
        .object({ limit: z.number().int().min(1).max(25).optional().default(15) })
        .parse(toolArgs);
      const { data, error } = await admin
        .from("operations_services")
        .select("id, name, duration_minutes, price_myr, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(parsed.limit);
      if (error) return { ok: false, error: "query_failed" };
      return { ok: true, services: data ?? [], count: data?.length ?? 0 };
    }

    case "list_booking_resources": {
      const parsed = z
        .object({ limit: z.number().int().min(1).max(25).optional().default(15) })
        .parse(toolArgs);
      const { data, error } = await admin
        .from("operations_booking_resources")
        .select("id, name, buffer_minutes, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(parsed.limit);
      if (error) return { ok: false, error: "query_failed" };
      return { ok: true, resources: data ?? [], count: data?.length ?? 0 };
    }

    case "adjust_stock": {
      const parsed = adjustStockSchema.parse(toolArgs);
      if (!parsed.product_id && !parsed.sku) {
        return { ok: false, error: "product_id_or_sku_required" };
      }
      let productQuery = admin
        .from("operations_products")
        .select("id, sku, name, stock_qty")
        .eq("business_id", businessId)
        .is("deleted_at", null);
      if (parsed.product_id) {
        productQuery = productQuery.eq("id", parsed.product_id);
      } else if (parsed.sku) {
        productQuery = productQuery.eq("sku", parsed.sku);
      }
      const { data: product } = await productQuery.maybeSingle();
      if (!product) return { ok: false, error: "product_not_found" };

      const { data, error } = await admin
        .from("operations_products")
        .update({ stock_qty: parsed.stock_qty })
        .eq("id", product.id)
        .select("id, sku, name, stock_qty")
        .single();
      if (error || !data) return { ok: false, error: "update_failed" };
      return {
        ok: true,
        action: "adjust_stock",
        product: data,
        link: "/operations/products",
        message: `✅ Stock for **${data.name}** (${data.sku}) set to **${data.stock_qty}**.`,
      };
    }

    case "create_product": {
      const parsed = createProductToolSchema.parse(toolArgs);
      const { data, error } = await admin
        .from("operations_products")
        .insert({
          business_id: businessId,
          sku: parsed.sku,
          name: parsed.name,
          description: parsed.description ?? null,
          category: parsed.category ?? null,
          price_myr: parsed.price_myr,
          is_active: true,
          stock_qty: parsed.stock_qty ?? null,
          low_stock_threshold: parsed.low_stock_threshold ?? 5,
          notes: parsed.notes ?? null,
          image_file_id: null,
          created_by: userId,
        })
        .select("id, sku, name, category, price_myr, stock_qty")
        .single();

      if (error) {
        const code = error.code === "23505" ? "duplicate_sku" : "create_failed";
        return {
          ok: false,
          error: code,
          message:
            code === "duplicate_sku"
              ? "That SKU already exists — use a different code."
              : "Could not create product.",
        };
      }
      if (!data) return { ok: false, error: "create_failed" };

      return {
        ok: true,
        action: "create_product",
        product: data,
        link: "/operations/products",
        message: `✅ Product **${data.name}** (\`${data.sku}\`) added to catalog.`,
      };
    }

    case "create_service": {
      const parsed = createServiceToolSchema.parse(toolArgs);
      const { data, error } = await admin
        .from("operations_services")
        .insert({
          business_id: businessId,
          name: parsed.name,
          description: parsed.description ?? null,
          duration_minutes: parsed.duration_minutes ?? 60,
          price_myr: parsed.price_myr ?? null,
          is_active: true,
          notes: parsed.notes ?? null,
          image_file_id: null,
          created_by: userId,
        })
        .select("id, name, duration_minutes, price_myr")
        .single();

      if (error) {
        const code =
          error.code === "23505" ? "duplicate_name" : "create_failed";
        return {
          ok: false,
          error: code,
          message:
            code === "duplicate_name"
              ? "A service with that name already exists."
              : "Could not create service.",
        };
      }
      if (!data) return { ok: false, error: "create_failed" };

      return {
        ok: true,
        action: "create_service",
        service: data,
        link: "/operations/services",
        message: `✅ Service **${data.name}** added (${data.duration_minutes} min).`,
      };
    }

    case "create_supplier": {
      const parsed = createSupplierToolSchema.parse(toolArgs);
      const { data, error } = await admin
        .from("operations_suppliers")
        .insert({
          business_id: businessId,
          name: parsed.name,
          contact_name: parsed.contact_name ?? null,
          phone: parsed.phone ?? null,
          email: parsed.email || null,
          address: parsed.address ?? null,
          payment_terms: parsed.payment_terms ?? null,
          notes: parsed.notes ?? null,
          created_by: userId,
        })
        .select("id, name, phone, payment_terms")
        .single();

      if (error) {
        return { ok: false, error: "create_failed", message: "Could not create supplier." };
      }
      if (!data) return { ok: false, error: "create_failed" };

      return {
        ok: true,
        action: "create_supplier",
        supplier: data,
        link: "/operations/suppliers",
        message: `✅ Supplier **${data.name}** added to your rolodex.`,
      };
    }

    case "update_product": {
      const parsed = updateProductToolSchema.parse(toolArgs);
      const located = await findProduct(admin, businessId, {
        product_id: parsed.product_id,
        lookup_sku: parsed.lookup_sku,
      });
      if (!located) return { ok: false, error: "product_not_found" };

      const { product_id: _pid, lookup_sku: _sku, ...patchRaw } = parsed;
      const patch = operationsProductUpdateSchema.parse(patchRaw);

      const { data, error } = await admin
        .from("operations_products")
        .update(patch)
        .eq("business_id", businessId)
        .eq("id", located.id as string)
        .is("deleted_at", null)
        .select("id, sku, name, price_myr, stock_qty, is_active")
        .single();

      if (error) {
        const code = error.code === "23505" ? "duplicate_sku" : "update_failed";
        return {
          ok: false,
          error: code,
          message:
            code === "duplicate_sku"
              ? "That SKU is already used by another product."
              : "Could not update product.",
        };
      }
      if (!data) return { ok: false, error: "update_failed" };

      return {
        ok: true,
        action: "update_product",
        product: data,
        link: "/operations/products",
        message: `✅ Product **${data.name}** (\`${data.sku}\`) updated.`,
      };
    }

    case "update_service": {
      const parsed = updateServiceToolSchema.parse(toolArgs);
      const located = await findService(admin, businessId, {
        service_id: parsed.service_id,
        service_name: parsed.service_name,
      });
      if (!located) return { ok: false, error: "service_not_found" };
      if ("ambiguous" in located) {
        return { ok: false, error: "ambiguous", matches: located.matches };
      }

      const { service_id: _sid, service_name: _name, ...patchRaw } = parsed;
      const patch = operationsServiceUpdateSchema.parse(patchRaw);

      const { data, error } = await admin
        .from("operations_services")
        .update(patch)
        .eq("business_id", businessId)
        .eq("id", located.id)
        .is("deleted_at", null)
        .select("id, name, duration_minutes, price_myr, is_active")
        .single();

      if (error) {
        const code =
          error.code === "23505" ? "duplicate_name" : "update_failed";
        return {
          ok: false,
          error: code,
          message:
            code === "duplicate_name"
              ? "Another service already uses that name."
              : "Could not update service.",
        };
      }
      if (!data) return { ok: false, error: "update_failed" };

      return {
        ok: true,
        action: "update_service",
        service: data,
        link: "/operations/services",
        message: `✅ Service **${data.name}** updated (${data.duration_minutes} min).`,
      };
    }

    case "create_booking": {
      const parsed = createBookingToolSchema.parse(toolArgs);

      let serviceTitle = parsed.service_title ?? "";
      let serviceId: string | null = parsed.service_id ?? null;
      let endsAt = parsed.ends_at ?? null;
      let amountMyr = parsed.amount_myr ?? null;

      if (parsed.service_id) {
        const { data: service } = await admin
          .from("operations_services")
          .select("id, name, duration_minutes, price_myr, is_active")
          .eq("business_id", businessId)
          .eq("id", parsed.service_id)
          .is("deleted_at", null)
          .maybeSingle();
        if (!service || !service.is_active) {
          return { ok: false, error: "service_not_found" };
        }
        serviceTitle = service.name as string;
        serviceId = service.id as string;
        if (!endsAt) {
          const startMs = new Date(parsed.starts_at).getTime();
          const durationMs = (service.duration_minutes as number) * 60_000;
          endsAt = new Date(startMs + durationMs).toISOString();
        }
        if (amountMyr == null && service.price_myr != null) {
          amountMyr = Number(service.price_myr);
        }
      }

      if (!endsAt) {
        return { ok: false, error: "ends_at_required" };
      }
      if (new Date(endsAt) <= new Date(parsed.starts_at)) {
        return { ok: false, error: "invalid_time_range" };
      }

      if (parsed.resource_id) {
        const conflicts = await findBookingConflicts(admin, businessId, {
          resourceId: parsed.resource_id,
          startsAt: parsed.starts_at,
          endsAt,
        });
        if (conflicts.length > 0) {
          return {
            ok: false,
            error: "slot_conflict",
            conflicts,
            message:
              "That resource is already booked for this slot (including buffer time).",
          };
        }
      }

      const number = await nextOperationsBookingNumber(admin, businessId);
      const { data, error } = await admin
        .from("operations_bookings")
        .insert({
          business_id: businessId,
          number,
          resource_id: parsed.resource_id ?? null,
          service_id: serviceId,
          customer_name: parsed.customer_name,
          customer_phone: parsed.customer_phone ?? null,
          service_title: serviceTitle,
          starts_at: parsed.starts_at,
          ends_at: endsAt,
          amount_myr: amountMyr,
          notes: parsed.notes ?? null,
          status: "held",
          created_by: userId,
        })
        .select("id, number, customer_name, service_title, status, starts_at")
        .single();
      if (error || !data) return { ok: false, error: "create_failed" };
      return {
        ok: true,
        action: "create_booking",
        booking: data,
        link: "/operations/bookings",
        message: `✅ Booking **${data.number}** created for **${data.customer_name}**.`,
      };
    }

    case "update_booking_status": {
      const parsed = updateBookingSchema.parse(toolArgs);
      let bookingId = parsed.booking_id;
      if (!bookingId && parsed.booking_number) {
        const safe = sanitizeLike(parsed.booking_number);
        const { data: matches } = await admin
          .from("operations_bookings")
          .select("id")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .ilike("number", `%${safe}%`)
          .limit(2);
        if (!matches?.length) return { ok: false, error: "booking_not_found" };
        if (matches.length > 1) return { ok: false, error: "ambiguous" };
        bookingId = matches[0].id as string;
      }
      if (!bookingId) return { ok: false, error: "booking_id_required" };

      const patch = operationsBookingUpdateSchema.parse({ status: parsed.status });
      const updatePayload: Record<string, unknown> = { ...patch };
      if (parsed.status === "completed") {
        updatePayload.completed_at = new Date().toISOString();
      }

      const { data, error } = await admin
        .from("operations_bookings")
        .update(updatePayload)
        .eq("business_id", businessId)
        .eq("id", bookingId)
        .is("deleted_at", null)
        .select("id, number, status")
        .single();
      if (error || !data) return { ok: false, error: "update_failed" };
      return {
        ok: true,
        action: "update_booking_status",
        booking: data,
        link: "/operations/bookings",
        message: `✅ Booking **${data.number}** is now **${parsed.status}**.`,
      };
    }

    case "get_order": {
      const parsed = z
        .object({
          order_id: z.string().uuid().optional(),
          order_number: z.string().trim().optional(),
          customer_name: z.string().trim().optional(),
        })
        .parse(toolArgs);

      if (!parsed.order_id && !parsed.order_number && !parsed.customer_name) {
        return { ok: false, error: "order_id_or_order_number_or_customer_name_required" };
      }

      if (parsed.order_id || parsed.order_number) {
        const found = await findOrder(admin, businessId, {
          order_id: parsed.order_id,
          order_number: parsed.order_number,
        });
        if (!found) return { ok: false, error: "order_not_found" };
        if ("ambiguous" in found && found.ambiguous) {
          return { ok: false, error: "ambiguous", matches: found.matches };
        }
        const { data } = await admin
          .from("operations_orders")
          .select(
            "id, number, customer_name, customer_phone, title, status, due_date, amount_myr, notes, created_at",
          )
          .eq("business_id", businessId)
          .eq("id", (found as { id: string }).id)
          .is("deleted_at", null)
          .maybeSingle();
        if (!data) return { ok: false, error: "order_not_found" };
        return { ok: true, order: data, href: `/operations/orders` };
      }

      // customer_name search
      const safe = sanitizeLike(parsed.customer_name!);
      const { data, error } = await admin
        .from("operations_orders")
        .select(
          "id, number, customer_name, customer_phone, title, status, due_date, amount_myr, notes, created_at",
        )
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .ilike("customer_name", `%${safe}%`)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) return { ok: false, error: "query_failed" };
      if (!data?.length) return { ok: false, error: "order_not_found" };
      if (data.length === 1) return { ok: true, order: data[0], href: `/operations/orders` };
      return { ok: true, orders: data, count: data.length, href: `/operations/orders` };
    }

    case "get_booking": {
      const parsed = z
        .object({
          booking_id: z.string().uuid().optional(),
          customer_name: z.string().trim().optional(),
          booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        })
        .parse(toolArgs);

      if (!parsed.booking_id && !parsed.customer_name && !parsed.booking_date) {
        return { ok: false, error: "booking_id_or_customer_name_or_date_required" };
      }

      let query = admin
        .from("operations_bookings")
        .select(
          "id, number, customer_name, customer_phone, service_title, resource_id, starts_at, ends_at, status, notes",
        )
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (parsed.booking_id) {
        query = query.eq("id", parsed.booking_id);
      } else {
        if (parsed.customer_name) {
          const safe = sanitizeLike(parsed.customer_name);
          query = query.ilike("customer_name", `%${safe}%`);
        }
        if (parsed.booking_date) {
          const dateStart = `${parsed.booking_date}T00:00:00+00:00`;
          const dateEnd = `${parsed.booking_date}T23:59:59+00:00`;
          query = query.gte("starts_at", dateStart).lte("starts_at", dateEnd);
        }
        query = query.order("starts_at", { ascending: true }).limit(5);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: "query_failed" };
      if (!data?.length) return { ok: false, error: "booking_not_found" };
      if (data.length === 1) return { ok: true, booking: data[0], href: `/operations/bookings` };
      return { ok: true, bookings: data, count: data.length, href: `/operations/bookings` };
    }

    case "get_supplier": {
      const parsed = z
        .object({
          supplier_id: z.string().uuid().optional(),
          supplier_name: z.string().trim().optional(),
        })
        .parse(toolArgs);

      if (!parsed.supplier_id && !parsed.supplier_name) {
        return { ok: false, error: "supplier_id_or_supplier_name_required" };
      }

      let query = admin
        .from("operations_suppliers")
        .select("id, name, contact_name, phone, email, address, payment_terms, notes")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (parsed.supplier_id) {
        query = query.eq("id", parsed.supplier_id);
      } else {
        const safe = sanitizeLike(parsed.supplier_name!);
        query = query.ilike("name", `%${safe}%`).limit(5);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: "query_failed" };
      if (!data?.length) return { ok: false, error: "supplier_not_found" };
      if (data.length === 1) return { ok: true, supplier: data[0], href: `/operations/suppliers` };
      return { ok: true, suppliers: data, count: data.length, href: `/operations/suppliers` };
    }

    case "get_stock_report": {
      const parsed = z
        .object({
          low_stock_only: z.boolean().optional().default(false),
          limit: z.number().int().min(1).max(50).optional().default(30),
        })
        .parse(toolArgs);

      const { data, error } = await admin
        .from("operations_products")
        .select("id, sku, name, category, price_myr, stock_qty, low_stock_threshold, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("stock_qty", { ascending: true })
        .limit(parsed.limit);

      if (error) return { ok: false, error: "query_failed" };

      const rows = data ?? [];
      const filtered = parsed.low_stock_only
        ? rows.filter((r) => {
            if (r.stock_qty == null) return false;
            const threshold = (r.low_stock_threshold as number) ?? 5;
            return (r.stock_qty as number) <= threshold;
          })
        : rows;

      const total_products = rows.length;
      const low_stock_count = rows.filter((r) => {
        if (r.stock_qty == null) return false;
        const threshold = (r.low_stock_threshold as number) ?? 5;
        return (r.stock_qty as number) <= threshold && (r.stock_qty as number) > 0;
      }).length;
      const out_of_stock_count = rows.filter((r) => (r.stock_qty as number) === 0).length;

      return {
        ok: true,
        summary: { total_products, low_stock_count, out_of_stock_count },
        products: filtered,
        href: `/operations/products`,
      };
    }

    default:
      return { ok: false, error: "unknown_tool" };
  }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: "validation_failed",
        message:
          "Invalid tool arguments. Use SKU for product codes, order/booking numbers for lookups, and UUIDs only when returned by list tools.",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      };
    }
    throw error;
  }
}
