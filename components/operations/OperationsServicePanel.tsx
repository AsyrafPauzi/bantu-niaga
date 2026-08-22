"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Clock,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { ModuleListSearchBar } from "@/components/dashboard/module-list-search";
import {
  OperationsCatalogEmpty,
  OperationsCatalogList,
} from "@/components/operations/OperationsCatalogUi";
import { ListPagination } from "@/components/ui/list-pagination";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import { OperationsProductThumb } from "@/components/operations/OperationsProductThumb";
import { QuickCreateActions } from "@/components/ui/quick-create";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { InlineFeedback } from "@/components/ui/alert";
import { useQuickCreate } from "@/hooks/use-quick-create";
import { cn } from "@/lib/utils/cn";
import {
  formatOrderAmount,
  type OperationsServiceRow,
} from "@/lib/operations/schemas";

interface OperationsServicePanelProps {
  initialServices: OperationsServiceRow[];
  page: number;
  pageSize: number;
  total: number;
  searchQuery: string;
}

export function OperationsServicePanel({
  initialServices,
  page,
  pageSize,
  total,
  searchQuery,
}: OperationsServicePanelProps) {
  const router = useRouter();
  const [services, setServices] = useState(initialServices);
  const [search, setSearch] = useState(searchQuery);
  const { open: showForm, close: closeForm, openPanel: openForm } =
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

  const onSearch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const q = search.trim();
      if (q) params.set("q", q);
      const qs = params.toString();
      router.push(qs ? `/operations/services?${qs}` : "/operations/services");
    },
    [router, search],
  );

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

  useEffect(() => {
    const handler = () => { resetForm(); openForm(); };
    window.addEventListener("operations:add-service", handler);
    return () => window.removeEventListener("operations:add-service", handler);
  }, [resetForm, openForm]);

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
      uploadOnly
      onAttach={async (fileId, fileName) => {
        setImageFileId(fileId);
        setImageFileName(fileName ?? null);
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

  const hasSearch = Boolean(searchQuery.trim());

  return (
    <div className="space-y-4">
      <Modal open={showForm} onClose={() => { closeForm(); resetForm(); }} size="lg">
        <ModalHeader
          title="New service"
          description="Duration and price — feeds bookings and quotes."
          onClose={() => { closeForm(); resetForm(); }}
        />
        <ModalBody>
          <form id="add-service-form" onSubmit={onCreate} className="space-y-3">
            {imagePicker}
            {formFields}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions
            submitLabel="Save service"
            loading={creating}
            onCancel={() => { closeForm(); resetForm(); }}
            form="add-service-form"
          />
        </ModalFooter>
      </Modal>

      <Modal
        open={Boolean(editingId && editingService)}
        onClose={resetForm}
        size="lg"
      >
        <ModalHeader
          title={editingService ? `Edit ${editingService.name}` : "Edit service"}
          description="Update name, duration, price, or photo."
          onClose={resetForm}
        />
        <ModalBody>
          <form id="edit-service-form" onSubmit={onUpdate} className="space-y-3">
            {imagePicker}
            {formFields}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions
            submitLabel="Save changes"
            loading={creating}
            onCancel={resetForm}
            form="edit-service-form"
          />
        </ModalFooter>
      </Modal>

      {services.length === 0 ? (
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
          total={total}
          filters={
            <form onSubmit={onSearch} className="flex items-center gap-2">
              <ModuleListSearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search services…"
                onClear={hasSearch ? () => { setSearch(""); router.push("/operations/services"); } : undefined}
              />
            </form>
          }
        >
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {services.map((s) => {
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
                    <div className="flex shrink-0 items-center gap-1 opacity-100">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(s)}
                        className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-700/20"
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

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/operations/services"
        searchParams={searchQuery ? { q: searchQuery } : {}}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </div>
  );
}
