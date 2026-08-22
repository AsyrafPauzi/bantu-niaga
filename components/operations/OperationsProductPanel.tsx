"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import { OperationsCatalogList } from "@/components/operations/OperationsCatalogUi";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import {
  CategoryIcon,
  OperationsProductThumb,
} from "@/components/operations/OperationsProductThumb";
import { mergeCategoryPresets } from "@/lib/operations/vertical";
import { ListPagination } from "@/components/ui/list-pagination";
import { QuickCreateActions } from "@/components/ui/quick-create";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { InlineFeedback } from "@/components/ui/alert";
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
  highlightProductId?: string | null;
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
  highlightProductId = null,
}: OperationsProductPanelProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState(searchQuery);
  const { open: showForm, close: closeForm, openPanel: openForm } =
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
  const [specFileId, setSpecFileId] = useState<string | null>(null);
  const [specFileName, setSpecFileName] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!highlightProductId) return;
    const el = document.getElementById(`product-${highlightProductId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightProductId]);

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
    setSpecFileId(null);
    setSpecFileName(null);
    setBarcode("");
    setEditingId(null);
    setFormError(null);
  }, []);

  useEffect(() => {
    const handler = () => { resetForm(); openForm(); };
    window.addEventListener("operations:add-product", handler);
    return () => window.removeEventListener("operations:add-product", handler);
  }, [resetForm, openForm]);

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
    setSpecFileId(product.spec_file_id);
    setSpecFileName(product.spec_file_name ?? null);
    setBarcode(product.barcode ?? "");
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
            barcode: barcode.trim() || null,
            image_file_id: imageFileId,
            spec_file_id: specFileId,
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
      barcode,
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
            barcode: barcode.trim() || null,
            image_file_id: imageFileId,
            spec_file_id: specFileId,
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
      barcode,
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
              <CategoryIcon category={cat} className="h-3 w-3 shrink-0 inline" /> {cat}
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
      uploadOnly
      disabled={creating || Boolean(busyId)}
      label="Product photo"
      onAttach={async (fileId, fileName) => {
        setImageFileId(fileId);
        setImageFileName(fileName ?? null);
      }}
    />
  );

  const specPicker = (
    <AdminStorageFileAttach
      fileId={specFileId}
      fileName={specFileName}
      category="operations"
      disabled={creating || Boolean(busyId)}
      label="Spec sheet / datasheet"
      onAttach={async (fileId, fileName) => {
        setSpecFileId(fileId);
        setSpecFileName(fileName ?? null);
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
      <div>
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Barcode (optional) — scan at POS checkout"
          className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-500">
          EAN, UPC, or QR code value. Scanning at POS will auto-add this product to the cart.
        </p>
      </div>
      {formError ? (
        <InlineFeedback>{formError}</InlineFeedback>
      ) : null}
    </>
  );

  const hasFilters =
    Boolean(searchQuery) ||
    (categoryFilter && categoryFilter !== "all") ||
    lowStockOnly;

  return (
    <div className="space-y-4">
      <Modal
        open={showForm}
        onClose={() => { closeForm(); resetForm(); }}
        size="lg"
      >
        <ModalHeader
          title="New product"
          description="SKU, price, and stock — shows up in Sales POS too."
          onClose={() => { closeForm(); resetForm(); }}
        />
        <ModalBody>
          <form id="add-product-form" onSubmit={onCreate} className="space-y-3">
            {formFields}
            {imagePicker}
            {specPicker}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions
            submitLabel="Save product"
            loading={creating}
            onCancel={() => { closeForm(); resetForm(); }}
            cancelLabel="Cancel"
            form="add-product-form"
          />
        </ModalFooter>
      </Modal>

      <Modal
        open={Boolean(editingId && editingProduct)}
        onClose={resetForm}
        size="lg"
      >
        <ModalHeader
          title={editingProduct ? `Edit ${editingProduct.name}` : "Edit product"}
          description="Update SKU, price, stock, or any other detail."
          onClose={resetForm}
        />
        <ModalBody>
          <form id="edit-product-form" onSubmit={onUpdate} className="space-y-3">
            {formFields}
            {imagePicker}
            {specPicker}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions
            submitLabel="Save changes"
            loading={creating}
            onCancel={resetForm}
            cancelLabel="Cancel"
            form="edit-product-form"
          />
        </ModalFooter>
      </Modal>

      <OperationsCatalogList
        title="Catalog"
        total={total}
        filters={
          <>
            {(allCategories.length > 0 || lowStockOnly) ? (
              <nav
                aria-label="Filter products"
                className="mb-3 flex flex-wrap gap-2"
              >
                <ModuleListFilterChipLink
                  href={buildListUrl({ category: "all", lowStock: false })}
                  active={categoryFilter === "all" && !lowStockOnly}
                  accent="emerald"
                  label="All"
                />
                {allCategories.map((cat) => (
                  <ModuleListFilterChipLink
                    key={cat}
                    href={buildListUrl({ category: cat, lowStock: false })}
                    active={categoryFilter === cat && !lowStockOnly}
                    accent="sky"
                    label={cat}
                  />
                ))}
                <ModuleListFilterChipLink
                  href={buildListUrl({ lowStock: !lowStockOnly })}
                  active={lowStockOnly}
                  accent="amber"
                  label="Low stock"
                />
              </nav>
            ) : null}
            <form
              onSubmit={onSearch}
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
            >
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-cream-300 bg-cream-50/50 px-3 py-2.5 dark:border-hairline-dark dark:bg-panel-dark/60">
                <Search
                  className="h-4 w-4 shrink-0 text-ink-muted"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SKU or name…"
                  className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none dark:text-cream-100"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
                >
                  Search
                </button>
                {hasFilters ? (
                  <Link
                    href="/operations/products"
                    className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-semibold text-ink-muted hover:text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>
          </>
        }
      >
        {products.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cream-200 bg-cream-50 text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400" aria-hidden>
              {hasFilters ? <Search className="h-6 w-6" /> : <Package className="h-6 w-6" />}
            </span>
            <p className="mt-3 text-sm font-semibold text-ink dark:text-cream-100">
              {hasFilters
                ? "No products match your filters"
                : "No products yet"}
            </p>
            <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
              {hasFilters
                ? "Try another category or clear search."
                : "Tap Add product — your first SKU takes under a minute."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {products.map((p) => {
              const busy = busyId === p.id;
              const price = formatOrderAmount(Number(p.price_myr));
              const low = isLowStock(p);

              if (editingId === p.id) return null;

              return (
                <li
                  key={p.id}
                  id={`product-${p.id}`}
                  className={cn(
                    "group px-3 py-2.5 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60",
                    low && "bg-amber-50/40 dark:bg-amber-950/10",
                    !p.is_active && "opacity-60",
                    highlightProductId === p.id &&
                      "ring-2 ring-inset ring-amber-300 dark:ring-amber-700",
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
                            · <CategoryIcon category={p.category} className="h-3 w-3 inline shrink-0" /> {p.category}
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

                    <div className="flex shrink-0 items-center gap-1 opacity-100">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(p)}
                        className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-700/20"
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
        )}
      </OperationsCatalogList>

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
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </div>
  );
}
