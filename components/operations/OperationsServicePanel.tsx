"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Clock,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { ModuleListSearchBar } from "@/components/dashboard/module-list-search";
import {
  OperationsCatalogEditShell,
  OperationsCatalogEmpty,
  OperationsCatalogList,
} from "@/components/operations/OperationsCatalogUi";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import { OperationsProductThumb } from "@/components/operations/OperationsProductThumb";
import {
  QuickActionBar,
  QuickCreateActions,
  QuickCreatePanel,
} from "@/components/ui/quick-create";
import { InlineFeedback } from "@/components/ui/alert";
import { useQuickCreate } from "@/hooks/use-quick-create";
import { cn } from "@/lib/utils/cn";
import {
  formatOrderAmount,
  type OperationsServiceRow,
} from "@/lib/operations/schemas";

interface OperationsServicePanelProps {
  initialServices: OperationsServiceRow[];
}

export function OperationsServicePanel({
  initialServices,
}: OperationsServicePanelProps) {
  const router = useRouter();
  const [services, setServices] = useState(initialServices);
  const [search, setSearch] = useState("");
  const { open: showForm, toggle: toggleForm, close: closeForm } =
    useQuickCreate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [priceMyr, setPriceMyr] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return services;
    return services.filter((s) => s.name.toLowerCase().includes(needle));
  }, [search, services]);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setDurationMinutes("60");
    setPriceMyr("");
    setNotes("");
    setImageFileId(null);
    setImageFileName(null);
    setEditingId(null);
    setFormError(null);
  }, []);

  const startEdit = useCallback(
    (service: OperationsServiceRow) => {
      setEditingId(service.id);
      setName(service.name);
      setDescription(service.description ?? "");
      setDurationMinutes(String(service.duration_minutes));
      setPriceMyr(
        service.price_myr != null ? String(service.price_myr) : "",
      );
      setNotes(service.notes ?? "");
      setImageFileId(service.image_file_id);
      setImageFileName(service.image_file_name ?? null);
      closeForm();
      setFormError(null);
    },
    [closeForm],
  );

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/operations/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || null,
            duration_minutes: Number.parseInt(durationMinutes, 10) || 60,
            price_myr: priceMyr === "" ? null : Number(priceMyr),
            notes: notes || null,
            image_file_id: imageFileId,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsServiceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not save service.");
        }
        setServices((prev) =>
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
      closeForm,
      description,
      durationMinutes,
      imageFileId,
      name,
      notes,
      priceMyr,
      refresh,
      resetForm,
    ],
  );

  const onUpdate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!editingId) return;
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch(`/api/operations/services/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || null,
            duration_minutes: Number.parseInt(durationMinutes, 10) || 60,
            price_myr: priceMyr === "" ? null : Number(priceMyr),
            notes: notes || null,
            image_file_id: imageFileId,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsServiceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not update service.");
        }
        setServices((prev) =>
          prev
            .map((s) => (s.id === editingId ? json.data! : s))
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
      description,
      durationMinutes,
      editingId,
      imageFileId,
      name,
      notes,
      priceMyr,
      refresh,
      resetForm,
    ],
  );

  const toggleActive = useCallback(
    async (service: OperationsServiceRow) => {
      setBusyId(service.id);
      try {
        const res = await fetch(`/api/operations/services/${service.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !service.is_active }),
        });
        if (!res.ok) throw new Error("Update failed.");
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsServiceRow;
        };
        if (json.data) {
          setServices((prev) =>
            prev.map((s) => (s.id === service.id ? json.data! : s)),
          );
        }
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const deleteService = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/services/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setServices((prev) => prev.filter((s) => s.id !== id));
        if (editingId === id) resetForm();
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [editingId, refresh, resetForm],
  );

  const editingService = editingId
    ? services.find((s) => s.id === editingId)
    : null;

  const imagePicker = (
    <AdminStorageFileAttach
      fileId={imageFileId}
      fileName={imageFileName}
      category="operations"
      imagesOnly
      disabled={creating || Boolean(busyId)}
      label="Service photo"
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Service name *"
          required
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <input
          type="number"
          min={5}
          max={480}
          step={5}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          placeholder="Duration (minutes)"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>
      <input
        type="number"
        min={0}
        step="0.01"
        value={priceMyr}
        onChange={(e) => setPriceMyr(e.target.value)}
        placeholder="Default price (MYR, optional)"
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
        <InlineFeedback>{formError}</InlineFeedback>
      ) : null}
    </>
  );

  const hasSearch = Boolean(search.trim());

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
        actionLabel="Add service"
      />

      <QuickCreatePanel
        open={showForm}
        onSubmit={onCreate}
        title="New service"
        subtitle="Duration and price — feeds bookings and quotes."
        icon={Wrench}
        accent="violet"
      >
        {imagePicker}
        {formFields}
        <QuickCreateActions
          submitLabel="Save service"
          loading={creating}
          onCancel={() => {
            closeForm();
            resetForm();
          }}
        />
      </QuickCreatePanel>

      {editingId && editingService ? (
        <OperationsCatalogEditShell
          title={`Editing ${editingService.name}`}
          accent="violet"
        >
          <form onSubmit={onUpdate} className="space-y-3">
            {imagePicker}
            {formFields}
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

      {filtered.length === 0 ? (
        <OperationsCatalogEmpty
          icon={hasSearch ? <Search className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
          title={
            hasSearch ? "No services match your search" : "No services yet"
          }
          hint={
            hasSearch
              ? "Try a different name."
              : "Tap Add service — your first menu item takes under a minute."
          }
        />
      ) : (
        <OperationsCatalogList
          title="Catalog"
          total={filtered.length}
          filters={
            <ModuleListSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search services…"
              onClear={hasSearch ? () => setSearch("") : undefined}
            />
          }
        >
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {filtered.map((s) => {
              if (editingId === s.id) return null;
              const busy = busyId === s.id;
              const price = formatOrderAmount(
                s.price_myr != null ? Number(s.price_myr) : null,
              );

              return (
                <li
                  key={s.id}
                  className={cn(
                    "group px-3 py-2.5 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60",
                    !s.is_active && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <OperationsProductThumb
                      imageFileId={s.image_file_id}
                      category="services"
                      name={s.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h3 className="truncate text-sm font-semibold text-ink dark:text-cream-100">
                          {s.name}
                        </h3>
                        {!s.is_active ? (
                          <span className="rounded bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                            Paused
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-ink-muted dark:text-cream-400">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {s.duration_minutes} min
                      </p>
                    </div>
                    <p className="hidden shrink-0 text-sm font-bold tabular-nums text-ink dark:text-cream-100 sm:block">
                      {price || "—"}
                    </p>
                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(s)}
                        className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-950/30"
                        aria-label={`Edit ${s.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(s)}
                        className="hidden rounded-md px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-cream-100 disabled:opacity-50 dark:text-cream-400 dark:hover:bg-panel-dark md:inline"
                      >
                        {s.is_active ? "Pause" : "On"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteService(s.id)}
                        className="rounded-md p-1.5 text-status-danger hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/20"
                        aria-label={`Remove ${s.name}`}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 pl-[3.75rem] text-sm font-bold tabular-nums text-ink dark:text-cream-100 sm:hidden">
                    {price || "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        </OperationsCatalogList>
      )}
    </div>
  );
}
