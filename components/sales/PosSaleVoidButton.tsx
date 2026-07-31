"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function PosSaleVoidButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVoid() {
    if (busy) return;
    const reason = window.prompt("Reason for void (optional):") ?? "";
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/pos/sales/${saleId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Void failed");
      router.refresh();
      router.push("/sales/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Void failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void onVoid()}
        disabled={busy}
        className="w-full rounded-xl border border-red-300 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
      >
        {busy ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        ) : (
          "Void sale"
        )}
      </button>
      {error ? (
        <p className="mt-2 text-center text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
