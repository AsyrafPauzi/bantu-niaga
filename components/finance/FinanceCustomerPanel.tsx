"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client-error";
import type { FinanceCustomerRow } from "@/lib/finance/schemas";

interface FinanceCustomerPanelProps {
  initialCustomers: FinanceCustomerRow[];
}

export function FinanceCustomerPanel({
  initialCustomers,
}: FinanceCustomerPanelProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const onCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const res = await fetch("/api/finance/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone: phone || null,
            email: email || null,
            address: address || null,
            notes: notes || null,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(apiErrorMessage(json, "Could not save customer."));
        }
        setCustomers((prev) =>
          [...prev, json.data as FinanceCustomerRow].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
        setName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setNotes("");
        setShowForm(false);
        refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setCreating(false);
      }
    },
    [address, email, name, notes, phone, refresh],
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/finance/customers/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed.");
        setCustomers((prev) => prev.filter((c) => c.id !== id));
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
          New customer
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-lg border border-cream-200 bg-white p-4 dark:border-hairline-dark dark:bg-panel-dark"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer / company name *"
              required
              className={inputCx}
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone / WhatsApp"
              className={inputCx}
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputCx}
          />
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            rows={2}
            className={inputCx}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            className={inputCx}
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
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save customer
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

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cream-300 py-12 text-center dark:border-hairline-dark">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            No customers yet. Add contacts once — reuse them on every invoice.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-white dark:divide-hairline-dark dark:border-hairline-dark dark:bg-panel-dark">
          {customers.map((c) => {
            const busy = busyId === c.id;
            return (
              <li key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink dark:text-cream-100">
                      {c.name}
                    </h3>
                    <div className="mt-2 space-y-1 text-xs text-ink-muted dark:text-cream-400">
                      {c.phone_e164 ? (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          {c.phone_e164}
                        </p>
                      ) : null}
                      {c.email ? (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          {c.email}
                        </p>
                      ) : null}
                      {c.address ? (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          {c.address}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteCustomer(c.id)}
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-status-danger hover:underline disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const inputCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";
