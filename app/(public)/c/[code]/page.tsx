import { formatMyr } from "@/lib/marketing/metrics";
import { loadPublicCouponByCode } from "@/lib/marketing/public-coupon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { code } = await params;
  return {
    title: `Coupon ${code.toUpperCase()}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicCouponPage({ params }: PageProps) {
  const { code } = await params;
  const offer = await loadPublicCouponByCode(decodeURIComponent(code));

  if (!offer) {
    return (
      <div className="rounded-2xl border border-cream-300 bg-white p-8 text-center shadow-card">
        <p className="text-sm font-semibold text-ink">Coupon not available</p>
        <p className="mt-2 text-sm text-ink-muted">
          This code is invalid, expired, or paused. Ask the shop for a new one.
        </p>
      </div>
    );
  }

  const discount =
    offer.type === "PCT"
      ? `${offer.value}% off`
      : `${formatMyr(offer.value)} off`;

  const validUntil = offer.valid_until
    ? new Date(offer.valid_until).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-card">
      <div className="bg-brand-600 px-6 py-8 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-100">
          {offer.business_name}
        </p>
        <h1 className="mt-3 font-mono text-3xl font-bold tracking-wide">
          {offer.code}
        </h1>
        <p className="mt-2 text-2xl font-semibold">{discount}</p>
        {offer.name ? (
          <p className="mt-1 text-sm text-brand-100">{offer.name}</p>
        ) : null}
      </div>
      <div className="space-y-3 px-6 py-6 text-sm text-ink-muted">
        {offer.min_subtotal_myr > 0 ? (
          <p>
            Min. spend:{" "}
            <strong className="text-ink">
              {formatMyr(offer.min_subtotal_myr)}
            </strong>
          </p>
        ) : (
          <p>No minimum spend.</p>
        )}
        {validUntil ? (
          <p>
            Valid until: <strong className="text-ink">{validUntil}</strong>
          </p>
        ) : (
          <p>No expiry date.</p>
        )}
        <p className="rounded-lg bg-cream-100 px-3 py-2 text-xs">
          Show this screen or tell the cashier your code when you pay. This page
          does not apply the discount automatically.
        </p>
      </div>
    </article>
  );
}
