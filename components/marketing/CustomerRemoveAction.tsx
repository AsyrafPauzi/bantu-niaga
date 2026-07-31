"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface CustomerRemoveActionProps {
  customerId: string;
  customerName: string;
  className?: string;
}

export function CustomerRemoveAction({
  customerId,
  customerName,
  className,
}: CustomerRemoveActionProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function remove() {
    const ok = confirm(
      `Remove ${customerName} from your CRM?\n\nThey will be hidden from lists and exports. Linked invoices and sales stay intact.`,
    );
    if (!ok) return;

    setError(null);
    try {
      const res = await fetch(`/api/marketing/customers/${customerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        setError(body?.message ?? body?.error ?? `Could not remove (HTTP ${res.status})`);
        return;
      }
      startTransition(() => {
        router.push("/marketing/customers");
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-300">
        Remove customer
      </p>
      <p className="mt-1.5 text-sm text-ink-muted dark:text-cream-400">
        Hides this profile from Marketing. POS and Finance records that
        reference them are not deleted.
      </p>
      <Button
        type="button"
        variant="danger"
        size="sm"
        className="mt-3"
        onClick={remove}
        disabled={pending}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        {pending ? "Removing…" : "Remove from CRM"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
