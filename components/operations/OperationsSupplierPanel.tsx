"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Search,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { ModuleListSearchBar } from "@/components/dashboard/module-list-search";
import { AdminStorageFileAttach } from "@/components/admin/AdminStorageFileAttach";
import {
  OperationsCatalogEmpty,
  OperationsCatalogList,
  OperationsCatalogThumb,
} from "@/components/operations/OperationsCatalogUi";
import { ListPagination } from "@/components/ui/list-pagination";
import { QuickCreateActions } from "@/components/ui/quick-create";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { InlineFeedback } from "@/components/ui/alert";
import { useQuickCreate } from "@/hooks/use-quick-create";
import { cn } from "@/lib/utils/cn";
import type { OperationsSupplierRow } from "@/lib/operations/schemas";

interface OperationsSupplierPanelProps {
  initialSuppliers: OperationsSupplierRow[];
  highlightSupplierId?: string | null;
  page: number;
  pageSize: number;
  total: number;
  searchQuery: string;
}

const PAYMENT_TERM_PRESETS = ["COD", "Net 7", "Net 14", "Net 30", "Net 60"];

export function OperationsSupplierPanel({
  initialSuppliers,
  highlightSupplierId = null,
  page,
  pageSize,
  total,
  searchQuery,
}: OperationsSupplierPanelProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState(searchQuery);
  const { open: showForm, close: closeForm, openPanel: openForm } =
    useQuickCreate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [adminFileId, setAdminFileId] = useState<string | null>(null);
  const [adminFileName, setAdminFileName] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!highlightSupplierId) return;
    const el = document.getElementById(`supplier-${highlightSupplierId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSupplierId]);

  const onSearch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const q = search.trim();
      if (q) params.set("q", q);
      const qs = params.toString();
      router.push(qs ? `/operations/suppliers?${qs}` : "/operations/suppliers");
    },
    [router, search],
  );

  const resetForm = useCallback(() => {
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setPaymentTerms("");
    setNotes("");
    setAdminFileId(null);
    setAdminFileName(null);
    setEditingId(null);
    setFormError(null);
  }, []);

  useEffect(() => {
    const handler = () => {
      resetForm();
      openForm();
    };
    window.addEventListener("operations:add-supplier", handler);
    return () => window.removeEventListener("operations:add-supplier", handler);
  }, [resetForm, openForm]);

  const startEdit = useCallback((supplier: OperationsSupplierRow) => {
    setEditingId(supplier.id);
    setName(supplier.name);
    setContactName(supplier.contact_name ?? "");
    setPhone(supplier.phone ?? "");
    setEmail(supplier.email ?? "");
    setAddress(supplier.address ?? "");
    setPaymentTerms(supplier.payment_terms ?? "");
    setNotes(supplier.notes ?? "");
    setAdminFileId(supplier.admin_file_id);
    setAdminFileName(supplier.admin_file_name ?? null);
    closeForm();
    setFormError(null);
  }, [closeForm]);

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/operations/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            contact_name: contactName || null,
            phone: phone || null,
            email: email || null,
            address: address || null,
            payment_terms: paymentTerms || null,
            notes: notes || null,
            admin_file_id: adminFileId,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsSupplierRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not save supplier.");
        }
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
      address,
      adminFileId,
      closeForm,
      contactName,
      email,
      name,
      notes,
      paymentTerms,
      phone,
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
        const res = await fetch(`/api/operations/suppliers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            contact_name: contactName || null,
            phone: phone || null,
            email: email || null,
            address: address || null,
            payment_terms: paymentTerms || null,
            notes: notes || null,
            admin_file_id: adminFileId,
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: OperationsSupplierRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Could not update supplier.");
        }
        setSuppliers((prev) =>
          prev
            .map((s) =>
              s.id === editingId
                ? {
                    ...json.data!,
                    admin_file_name: adminFileName,
                  }
                : s,
            )
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
      address,
      adminFileId,
      adminFileName,
      contactName,
      editingId,
      email,
      name,
      notes,
      paymentTerms,
      phone,
      refresh,
      resetForm,
    ],
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/operations/suppliers/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        if (editingId === id) resetForm();
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [editingId, refresh, resetForm],
  );

  const editingSupplier = editingId
    ? suppliers.find((s) => s.id === editingId)
    : null;

  const contractPicker = (
    <AdminStorageFileAttach
      fileId={adminFileId}
      fileName={adminFileName}
      category="contract"
      disabled={creating || Boolean(busyId)}
      label="Contract / agreement"
      onAttach={async (fileId, fileName) => {
        setAdminFileId(fileId);
        setAdminFileName(fileName ?? null);
      }}
    />
  );

  const paymentTermsPicker = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PAYMENT_TERM_PRESETS.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => setPaymentTerms(term)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
              paymentTerms === term
                ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                : "border-cream-300 text-ink-muted hover:bg-cream-50 dark:border-hairline-dark dark:text-cream-400 dark:hover:bg-panel-dark",
            )}
          >
            {term}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={paymentTerms}
        onChange={(e) => setPaymentTerms(e.target.value)}
        placeholder="Payment terms (e.g. Net 30, COD)"
        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
    </div>
  );

  const formFields = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Supplier / vendor name *"
          required
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <input
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Contact person"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone / WhatsApp"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        />
      </div>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (optional)"
        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
      {paymentTermsPicker}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Internal notes (optional)"
        rows={2}
        className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
      />
      {formError ? <InlineFeedback>{formError}</InlineFeedback> : null}
    </>
  );

  const hasSearch = Boolean(searchQuery.trim());

  return (
    <div className="space-y-4">
      <Modal
        open={showForm}
        onClose={() => {
          closeForm();
          resetForm();
        }}
        size="lg"
      >
        <ModalHeader
          title="New supplier"
          description="Who you buy from — reach them fast when stock runs low."
          onClose={() => {
            closeForm();
            resetForm();
          }}
        />
        <ModalBody>
          <form id="add-supplier-form" onSubmit={onCreate} className="space-y-3">
            {formFields}
            {contractPicker}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions
            submitLabel="Save supplier"
            loading={creating}
            onCancel={() => {
              closeForm();
              resetForm();
            }}
            form="add-supplier-form"
          />
        </ModalFooter>
      </Modal>

      <Modal
        open={Boolean(editingId && editingSupplier)}
        onClose={resetForm}
        size="lg"
      >
        <ModalHeader
          title={editingSupplier ? `Edit ${editingSupplier.name}` : "Edit supplier"}
          description="Update contact, payment terms, or contract."
          onClose={resetForm}
        />
        <ModalBody>
          <form id="edit-supplier-form" onSubmit={onUpdate} className="space-y-3">
            {formFields}
            {contractPicker}
          </form>
        </ModalBody>
        <ModalFooter>
          <QuickCreateActions
            submitLabel="Save changes"
            loading={creating}
            onCancel={resetForm}
            form="edit-supplier-form"
          />
        </ModalFooter>
      </Modal>

      {suppliers.length === 0 ? (
        <OperationsCatalogEmpty
          icon={hasSearch ? <Search className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
          title={
            hasSearch ? "No suppliers match your search" : "No suppliers yet"
          }
          hint={
            hasSearch
              ? "Try another name, phone, or payment term."
              : "Tap Add supplier — your vendor rolodex starts here."
          }
        />
      ) : (
        <OperationsCatalogList
          title="Vendor list"
          total={total}
          filters={
            <form onSubmit={onSearch}>
              <ModuleListSearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search vendors…"
                onClear={
                  search.trim()
                    ? () => {
                        setSearch("");
                        router.push("/operations/suppliers");
                      }
                    : undefined
                }
              />
            </form>
          }
        >
          <ul className="divide-y divide-cream-100 dark:divide-hairline-dark">
            {suppliers.map((s) => {
              const busy = busyId === s.id;

              return (
                <li
                  key={s.id}
                  id={`supplier-${s.id}`}
                  className={cn(
                    "group px-3 py-2.5 transition-colors hover:bg-cream-50/80 dark:hover:bg-panel-dark/60",
                    highlightSupplierId === s.id &&
                      "bg-amber-50/90 ring-2 ring-inset ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-700",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <OperationsCatalogThumb icon={<Truck className="h-6 w-6" />} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
                          {s.name}
                        </h3>
                        {s.payment_terms ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                            {s.payment_terms}
                          </span>
                        ) : null}
                        {s.admin_file_id ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
                            <FileText className="h-2.5 w-2.5" />
                            Contract
                          </span>
                        ) : null}
                      </div>
                      {s.contact_name ? (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted dark:text-cream-400">
                          <User className="h-3 w-3 shrink-0" />
                          {s.contact_name}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-muted dark:text-cream-400">
                        {s.phone ? (
                          <a
                            href={`tel:${s.phone.replace(/\s/g, "")}`}
                            className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300"
                          >
                            <Phone className="h-3 w-3 shrink-0" />
                            {s.phone}
                          </a>
                        ) : null}
                        {s.email ? (
                          <a
                            href={`mailto:${s.email}`}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <Mail className="h-3 w-3 shrink-0" />
                            {s.email}
                          </a>
                        ) : null}
                        {!s.phone && !s.email && !s.contact_name ? (
                          <span className="italic text-ink-subtle dark:text-cream-500">
                            No contact details yet
                          </span>
                        ) : null}
                      </div>
                    </div>
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
                        onClick={() => void deleteSupplier(s.id)}
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
                </li>
              );
            })}
          </ul>
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/operations/suppliers"
            searchParams={{ q: searchQuery || undefined }}
            pageSizeOptions={[10, 25, 50]}
            className="border-t border-cream-200 dark:border-hairline-dark"
          />
        </OperationsCatalogList>
      )}
    </div>
  );
}
