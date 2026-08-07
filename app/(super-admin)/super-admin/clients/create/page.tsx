"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PageTopbar } from "@/components/super-admin/PageTopbar";
import { TIERS } from "@/lib/settings/plans";

const TIER_OPTIONS = TIERS.map((t) => ({ value: t.key, label: t.label }));

export default function SuperAdminCreateClientPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = new FormData(e.currentTarget);
    const promoMonths = Number(form.get("promo_months") || 0);
    const promoTier = String(form.get("promo_tier") || "").trim();

    const payload: Record<string, unknown> = {
      business_name: String(form.get("business_name") || "").trim(),
      owner_email: String(form.get("owner_email") || "").trim(),
      owner_display_name: String(form.get("owner_display_name") || "").trim() || undefined,
      tier: String(form.get("tier") || "starter"),
      campaign_code: String(form.get("campaign_code") || "").trim() || undefined,
      notes: String(form.get("notes") || "").trim() || undefined,
    };

    if (promoMonths > 0 && promoTier) {
      payload.promo = { tier: promoTier, months: promoMonths };
      const postPromo = String(form.get("post_promo_tier") || "").trim();
      if (postPromo) payload.post_promo_tier = postPromo;
    }

    startTransition(async () => {
      const res = await fetch("/api/super-admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message ?? json?.error ?? "Could not create client");
        return;
      }
      setSuccess(
        `Created ${json.idcompany} — invite sent to ${json.ownerEmail}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageTopbar
        title="Create client account"
        subtitle="Provision a tenant for campaigns or sales-assisted onboarding."
      />

      <form
        onSubmit={onSubmit}
        className="max-w-xl space-y-4 rounded-xl border border-cream-300/60 bg-cream-50 p-6 dark:border-cream-700/40 dark:bg-ink-900"
      >
        <div>
          <label className="text-sm font-medium" htmlFor="business_name">
            Business name
          </label>
          <input
            id="business_name"
            name="business_name"
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="owner_email">
            Owner email
          </label>
          <input
            id="owner_email"
            name="owner_email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="owner_display_name">
            Owner display name
          </label>
          <input
            id="owner_display_name"
            name="owner_display_name"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="tier">
            Plan tier (billing after promo)
          </label>
          <select
            id="tier"
            name="tier"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            defaultValue="micro"
          >
            {TIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-dashed p-4">
          <legend className="text-sm font-medium">Optional promo grant</legend>
          <p className="text-xs text-muted-foreground">
            e.g. Solo (micro) for 3 months free on a roadshow campaign.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm" htmlFor="promo_tier">Promo tier</label>
              <select
                id="promo_tier"
                name="promo_tier"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="">None</option>
                {TIER_OPTIONS.filter((o) => o.value !== "starter").map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm" htmlFor="promo_months">Months free</label>
              <input
                id="promo_months"
                name="promo_months"
                type="number"
                min={0}
                max={24}
                defaultValue={0}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm" htmlFor="post_promo_tier">
              After promo ends (if different from plan tier)
            </label>
            <select
              id="post_promo_tier"
              name="post_promo_tier"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Same as plan tier</option>
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm" htmlFor="campaign_code">Campaign code</label>
            <input
              id="campaign_code"
              name="campaign_code"
              placeholder="MSME-ROADSHOW-2026"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        <div>
          <label className="text-sm font-medium" htmlFor="notes">Internal notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        {error ? (
          <p className="text-sm text-status-danger">{error}</p>
        ) : null}
        {success ? (
          <p className="text-sm text-status-success">{success}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create & invite owner
        </button>
      </form>
    </div>
  );
}
