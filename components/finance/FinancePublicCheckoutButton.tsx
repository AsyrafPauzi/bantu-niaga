"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

interface FinancePublicCheckoutButtonProps {
  idcompany: string;
  shareHash: string;
  disabled?: boolean;
}

export function FinancePublicCheckoutButton({
  idcompany,
  shareHash,
  disabled = false,
}: FinancePublicCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function payOnline() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/invoices/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idcompany, share_hash: shareHash }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        configured?: boolean;
        data?: { checkout_url?: string };
        error?: { message?: string };
      };

      if (!res.ok || !json.ok || !json.data?.checkout_url) {
        const msg =
          json.error?.message ??
          (json.configured === false
            ? "Online payment is not available yet — use DuitNow below."
            : "Could not start checkout.");
        setError(msg);
        return;
      }

      window.location.href = json.data.checkout_url;
    } catch {
      setError("Checkout failed. Try DuitNow transfer instead.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => void payOnline()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        Pay online (FPX / card)
      </button>
      {error ? (
        <p className="text-xs text-status-danger">{error}</p>
      ) : (
        <p className="text-xs text-ink-muted dark:text-cream-400">
          Secured by Billplz when enabled on the platform.
        </p>
      )}
    </div>
  );
}
