"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import {
  formatOrderAmount,
  type OperationsProductRow,
} from "@/lib/operations/schemas";

interface OperationsProductPanelProps {
  initialProducts: OperationsProductRow[];
}

export function OperationsProductPanel({
  initialProducts,
}: OperationsProductPanelProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceMyr, setPriceMyr] = useState("");
  const [notes, setNotes] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    if (filterCategory === "all") return products;
    return products.filter((p) => (p.category ?? "") === filterCategory);
  }, [filterCategory, products]);

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
            notes: notes || null,
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
        setSku("");
        setName("");
        setDescription("");
        setCategory("");
        setPriceMyr("");
        setNotes("");
        setShowForm(false);
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [category, description, name, notes, priceMyr, refresh, sku],
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add product
        </button>
        {categories.length > 0 ? (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-lg border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
        >
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
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (e.g. Beverages)"
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceMyr}
              onChange={(e) => setPriceMyr(e.target.value)}
              placeholder="Price (MYR)"
              className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={2}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes"
            rows={2}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
          />
          {formError ? (
            <p className="text-sm text-status-danger">{formError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save product
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-muted dark:border-hairline-dark dark:text-cream-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cream-300 py-12 text-center dark:border-hairline-dark">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            No products yet. Add your first catalog item.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-white dark:divide-hairline-dark dark:border-hairline-dark dark:bg-panel-dark">
          {filtered.map((p) => {
            const busy = busyId === p.id;
            const price = formatOrderAmount(Number(p.price_myr));
            return (
              <li key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
                        {p.name}
                      </h3>
                      <span className="font-mono text-xs text-ink-muted dark:text-cream-400">
                        {p.sku}
                      </span>
                      {!p.is_active ? (
                        <span className="rounded bg-cream-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-cream-400">
                      {p.category ? (
                        <span className="inline-flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {p.category}
                        </span>
                      ) : null}
                      {price ? (
                        <span className="font-medium text-ink dark:text-cream-100">
                          {price}
                        </span>
                      ) : null}
                    </div>
                    {p.description ? (
                      <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
                        {p.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleActive(p)}
                      className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300"
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteProduct(p.id)}
                      className="inline-flex items-center gap-1 text-xs text-status-danger hover:underline disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
