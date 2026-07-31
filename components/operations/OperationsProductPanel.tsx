"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import {
  OperationsCatalogEditShell,
  OperationsCatalogEmpty,
  OperationsCatalogList,
} from "@/components/operations/OperationsCatalogUi";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import {
  categoryEmoji,
  OperationsProductThumb,
} from "@/components/operations/OperationsProductThumb";
import { mergeCategoryPresets } from "@/lib/operations/vertical";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  QuickActionBar,
  QuickCreateActions,
  QuickCreatePanel,
} from "@/components/ui/quick-create";
import { useQuickCreate } from "@/hooks/use-quick-create";
import { cn } from "@/lib/utils/cn";
import {
  formatOrderAmount,
  type OperationsProductRow,
} from "@/lib/operations/schemas";

interface OperationsProductPanelProps {
  initialProducts: OperationsProductRow[];
  allCategories: string[];
  categoryPresets: string[];
  page: number;
  pageSize: number;
  total: number;
  searchQuery: string;
  categoryFilter: string;
  lowStockOnly?: boolean;
}

function isLowStock(product: OperationsProductRow): boolean {
  if (product.stock_qty == null) return false;
  return product.stock_qty <= (product.low_stock_threshold ?? 5);
}

export function OperationsProductPanel({
  initialProducts,
  allCategories,
  categoryPresets,
  page,
  pageSize,
  total,
  searchQuery,
  categoryFilter,
  lowStockOnly = false,
}: OperationsProductPanelProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState(searchQuery);
  const { open: showForm, toggle: toggleForm, close: closeForm } =
    useQuickCreate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceMyr, setPriceMyr] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [notes, setNotes] = useState("");
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const categoryOptions = useMemo(
    () => mergeCategoryPresets(categoryPresets, allCategories),
    [allCategories, categoryPresets],
  );

  const buildListUrl = useCallback(
    (overrides?: { category?: string; lowStock?: boolean }) => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      const cat = overrides?.category ?? categoryFilter;
      if (cat && cat !== "all") params.set("category", cat);
      const low = overrides?.lowStock ?? lowStockOnly;
      if (low) params.set("low_stock", "1");
      const qs = params.toString();
      return qs ? `/operations/products?${qs}` : "/operations/products";
    },
    [categoryFilter, lowStockOnly, searchQuery],
  );

  const resetForm = useCallback(() => {
    setSku("");
    setName("");
    setDescription("");
    setCategory("");
    setPriceMyr("");
    setStockQty("");
    setLowStockThreshold("5");
    setNotes("");
    setImageFileId(null);
    setImageFileName(null);
    setEditingId(null);
    setFormError(null);
  }, []);

  const startEdit = useCallback((product: OperationsProductRow) => {
    setEditingId(product.id);
    setSku(product.sku);
    setName(product.name);
    setDescription(product.description ?? "");
    setCategory(product.category ?? "");
    setPriceMyr(String(product.price_myr));
    setStockQty(
      product.stock_qty != null ? String(product.stock_qty) : "",
    );
    setLowStockThreshold(String(product.low_stock_threshold));
    setNotes(product.notes ?? "");
    setImageFileId(product.image_file_id);
    setImageFileName(product.image_file_name ?? null);
    closeForm();
    setFormError(null);
  }, [closeForm]);

  const onSearch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const q = search.trim();
      if (q) params.set("q", q);
      if (categoryFilter && categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }
      if (lowStockOnly) params.set("low_stock", "1");
      const qs = params.toString();
      router.push(qs ? `/operations/products?${qs}` : "/operations/products");
    },
    [categoryFilter, lowStockOnly, router, search],
  );

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/operations/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku,
            name,
            description: description || null,
            category: category || null,
            price_myr: priceMyr === "" ? 0 : Number(priceMyr),
            stock_qty:
              stockQty.trim() === "" ? null : Number.parseInt(stockQty, 10),
            low_stock_threshold:
              lowStockThreshold.trim() === ""
                ? 5
                : Number.parseInt(lowStockThreshold, 10),
            notes: notes || null,
            image_file_id: imageFileId,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsProductRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not save product.");
        }
        setProducts((prev) =>
          [...prev, json.data!].sort((a, b) => a.name.localeCompare(b.name)),
        );
        resetForm();
        closeForm();
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [
      category,
      closeForm,
      description,
      imageFileId,
      lowStockThreshold,
      name,
      notes,
      priceMyr,
      refresh,
      resetForm,
      sku,
      stockQty,
    ],
  );

  const onUpdate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!editingId) return;
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch(`/api/operations/products/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku,
            name,
            description: description || null,
            category: category || null,
            price_myr: priceMyr === "" ? 0 : Number(priceMyr),
            stock_qty:
              stockQty.trim() === "" ? null : Number.parseInt(stockQty, 10),
            low_stock_threshold:
              lowStockThreshold.trim() === ""
                ? 5
                : Number.parseInt(lowStockThreshold, 10),
            notes: notes || null,
            image_file_id: imageFileId,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsProductRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not update product.");
        }
        setProducts((prev) =>
          prev
            .map((p) => (p.id === editingId ? json.data! : p))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        resetForm();
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Update failed.");
      } finally {
        setCreating(false);
      }
    },
    [
      category,
      description,
      editingId,
      imageFileId,
      lowStockThreshold,
      name,
      notes,
      priceMyr,
      refresh,
      resetForm,
      sku,
      stockQty,
    ],
  );

  const adjustStock = useCallback(
    async (product: OperationsProductRow, delta: number) => {
      const current = product.stock_qty ?? 0;
      const next = Math.max(0, current + delta);
      setBusyId(product.id);
      try {
        const res = await fetch(`/api/operations/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock_qty: next }),
        });
        if (!res.ok) throw new Error("Stock update failed.");
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsProductRow;
        };
        if (json.data) {
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? json.data! : p)),
          );
        }
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const toggleActive = useCallback(
    async (product: OperationsProductRow) => {
      setBusyId(product.id);
      try {
        const res = await fetch(`/api/operations/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !product.is_active }),
        });
        if (!res.ok) throw new Error("Update failed.");
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsProductRow;
        };
        if (json.data) {
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? json.data! : p)),
          );
        }
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/products/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setProducts((prev) => prev.filter((p) => p.id !== id));
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const editingProduct = editingId
    ? products.find((p) => p.id === editingId)
    : null;

  const categoryPicker = (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
        Category
      </p>
      <div className="flex flex-wrap gap-1.5">
        {categoryOptions.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                active
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-cream-300 bg-white text-ink-muted hover:border-brand-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
              )}
            >
              {categoryEmoji(cat)} {cat}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Or type a custom category"
        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
    </div>
  );

  const imagePicker = (
    <AdminStorageFileAttach
      fileId={imageFileId}
      fileName={imageFileName}
      category="operations"
      imagesOnly
      disabled={creating || Boolean(busyId)}
      label="Product photo"
      onAttach={async (fileId) => {
        setImageFileId(fileId);
        setImageFileName(null);
      }}
    />
  );

  const formFields = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU *"
          required
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name *"
          required
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>
      {categoryPicker}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={priceMyr}
          onChange={(e) => setPriceMyr(e.target.value)}
          placeholder="Price (MYR)"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <input
          type="number"
          min={0}
          step="1"
          value={stockQty}
          onChange={(e) => setStockQty(e.target.value)}
          placeholder="Stock qty (optional)"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>
      <input
        type="number"
        min={0}
        step="1"
        value={lowStockThreshold}
        onChange={(e) => setLowStockThreshold(e.target.value)}
        placeholder="Low-stock alert at"
        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Internal notes (optional)"
        rows={2}
        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
      {formError ? (
        <p className="text-sm text-status-danger">{formError}</p>
      ) : null}
    </>
  );

  const hasFilters =
    Boolean(searchQuery) ||
    (categoryFilter && categoryFilter !== "all") ||
    lowStockOnly;

  return (
    <div className="space-y-4">
      <QuickActionBar
        open={showForm}
        onToggle={() => {
          if (showForm) {
            closeForm();
            resetForm();
          } else {
            resetForm();
            toggleForm();
          }
        }}
        actionLabel="Add product"
      >
        <form
          onSubmit={onSearch}
          className="relative min-w-[12rem] flex-1 sm:max-w-xs"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU or name…"
            className="w-full rounded-lg border border-cream-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
        </form>
      </QuickActionBar>

      {(allCategories.length > 0 || lowStockOnly) && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildListUrl({ category: "all", lowStock: false })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              categoryFilter === "all" && !lowStockOnly
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
                : "border-cream-300 bg-white text-ink-muted hover:border-emerald-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            <Package className="h-3.5 w-3.5" />
            All
          </Link>
          {allCategories.map((cat) => {
            const active = categoryFilter === cat && !lowStockOnly;
            return (
              <Link
                key={cat}
                href={buildListUrl({ category: cat, lowStock: false })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"
                    : "border-cream-300 bg-white text-ink-muted hover:border-sky-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
                )}
              >
                <span aria-hidden>{categoryEmoji(cat)}</span>
                {cat}
              </Link>
            );
          })}
          <Link
            href={buildListUrl({ lowStock: !lowStockOnly })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              lowStockOnly
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                : "border-cream-300 bg-white text-ink-muted hover:border-amber-200 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400",
            )}
          >
            ⚠️ Low stock
          </Link>
        </div>
      )}

      <QuickCreatePanel
        open={showForm}
        onSubmit={onCreate}
        title="New product"
        subtitle="SKU, price, and stock — shows up in Sales POS too."
        icon={Tag}
        accent="emerald"
      >
        {formFields}
        {imagePicker}
        <QuickCreateActions
          submitLabel="Save product"
          loading={creating}
          onCancel={() => {
            closeForm();
            resetForm();
          }}
        />
      </QuickCreatePanel>

      {editingId && editingProduct ? (
        <OperationsCatalogEditShell
          title={`Editing ${editingProduct.name}`}
          accent="emerald"
        >
          <form onSubmit={onUpdate} className="space-y-3">
            {formFields}
            {imagePicker}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </OperationsCatalogEditShell>
      ) : null}

      {products.length === 0 ? (
        <OperationsCatalogEmpty
          icon={hasFilters ? "🔍" : "📦"}
          title={hasFilters ? "No products match your filters" : "No products yet"}
          hint={
            hasFilters
              ? "Try another category or clear search."
              : "Tap Add product — your first SKU takes under a minute."
          }
          action={
            hasFilters ? (
              <Link
                href="/operations/products"
                className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <OperationsCatalogList title="Catalog" total={total}>
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {products.map((p) => {
              const busy = busyId === p.id;
              const price = formatOrderAmount(Number(p.price_myr));
              const low = isLowStock(p);

              if (editingId === p.id) return null;

              return (
                <li
                  key={p.id}
                  className={cn(
                    "group px-3 py-2.5 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60",
                    low && "bg-amber-50/40 dark:bg-amber-950/10",
                    !p.is_active && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <OperationsProductThumb
                      imageFileId={p.image_file_id}
                      category={p.category}
                      name={p.name}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h3 className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                          {p.name}
                        </h3>
                        {!p.is_active ? (
                          <span className="rounded bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                            Paused
                          </span>
                        ) : null}
                        {low ? (
                          <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                            Low
                          </span>
                        ) : null}
                      </div>
                      <p className="font-mono text-[11px] text-ink-muted dark:text-cream-400">
                        {p.sku}
                        {p.category ? (
                          <span className="ml-2 font-sans">
                            · {categoryEmoji(p.category)} {p.category}
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <p className="hidden shrink-0 text-sm font-bold tabular-nums text-ink dark:text-cream-100 sm:block">
                      {price || "RM 0.00"}
                    </p>

                    {p.stock_qty != null ? (
                      <div className="hidden items-center gap-1 sm:flex">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjustStock(p, -1)}
                          className="rounded-md border border-cream-300 p-1 hover:bg-white disabled:opacity-50 dark:border-hairline-dark dark:hover:bg-panel-dark"
                          aria-label={`Decrease stock for ${p.name}`}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span
                          className={cn(
                            "min-w-[2rem] text-center text-xs font-semibold tabular-nums",
                            low
                              ? "text-amber-800 dark:text-amber-200"
                              : "text-ink-muted dark:text-cream-300",
                          )}
                        >
                          {p.stock_qty}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjustStock(p, 1)}
                          className="rounded-md border border-cream-300 p-1 hover:bg-white disabled:opacity-50 dark:border-hairline-dark dark:hover:bg-panel-dark"
                          aria-label={`Increase stock for ${p.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="hidden text-[11px] text-ink-muted dark:text-cream-400 sm:block">
                        No stock
                      </span>
                    )}

                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(p)}
                        className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-950/30"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(p)}
                        className="hidden rounded-md px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-cream-100 disabled:opacity-50 dark:text-cream-400 dark:hover:bg-panel-dark md:inline"
                      >
                        {p.is_active ? "Pause" : "On"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteProduct(p.id)}
                        className="rounded-md p-1.5 text-status-danger hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/20"
                        aria-label={`Remove ${p.name}`}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between pl-[3.75rem] sm:hidden">
                    <p className="text-sm font-bold tabular-nums text-ink dark:text-cream-100">
                      {price || "RM 0.00"}
                    </p>
                    {p.stock_qty != null ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjustStock(p, -1)}
                          className="rounded-md border border-cream-300 p-1 disabled:opacity-50 dark:border-hairline-dark"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center text-xs font-semibold tabular-nums">
                          {p.stock_qty}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void adjustStock(p, 1)}
                          className="rounded-md border border-cream-300 p-1 disabled:opacity-50 dark:border-hairline-dark"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </OperationsCatalogList>
      )}

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/operations/products"
        searchParams={{
          ...(searchQuery ? { q: searchQuery } : {}),
          ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
          ...(lowStockOnly ? { low_stock: "1" } : {}),
        }}
      />
    </div>
  );
}
