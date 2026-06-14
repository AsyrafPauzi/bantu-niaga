"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Image as ImageIcon,
  Loader2,
  Mail,
  Palette,
  Receipt,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HEX_COLOR_REGEX } from "@/lib/settings/schemas";

const PRIMARY_SWATCHES = [
  { value: "#5B8C5A", label: "Sage" },
  { value: "#0F4C81", label: "Indigo" },
  { value: "#B85738", label: "Terracotta" },
  { value: "#7D5BA6", label: "Plum" },
  { value: "#1F7A8C", label: "Teal" },
  { value: "#1F1F1F", label: "Charcoal" },
];

const ACCENT_SWATCHES = [
  { value: "#F4A340", label: "Mandarin" },
  { value: "#E94E77", label: "Rose" },
  { value: "#3FB68C", label: "Mint" },
  { value: "#5E8AC4", label: "Sky" },
  { value: "#C2A86B", label: "Gold" },
  { value: "#A05BC0", label: "Orchid" },
];

interface BrandingFormProps {
  initial: {
    name: string;
    logo_url: string | null;
    brand_primary_hex: string;
    brand_accent_hex: string;
    registration_no: string | null;
    sst_number: string | null;
    contact_line: string | null;
    receipt_footer: string | null;
    email_from_name: string | null;
    email_reply_to: string | null;
  };
  canEdit: boolean;
}

export function BrandingForm({ initial, canEdit }: BrandingFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial.name);
  const [primary, setPrimary] = useState(initial.brand_primary_hex);
  const [accent, setAccent] = useState(initial.brand_accent_hex);
  const [registrationNo, setRegistrationNo] = useState(
    initial.registration_no ?? "",
  );
  const [sstNumber, setSstNumber] = useState(initial.sst_number ?? "");
  const [contactLine, setContactLine] = useState(initial.contact_line ?? "");
  const [receiptFooter, setReceiptFooter] = useState(
    initial.receipt_footer ?? "",
  );
  const [emailFromName, setEmailFromName] = useState(
    initial.email_from_name ?? "",
  );
  const [emailReplyTo, setEmailReplyTo] = useState(
    initial.email_reply_to ?? "",
  );
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);

  const [logoBusy, setLogoBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Receipt preview values are computed on the client only to avoid
  // SSR/CSR hydration mismatches (clock advances between render and hydrate).
  const [previewDate, setPreviewDate] = useState("—");
  const [previewTime, setPreviewTime] = useState("—");
  const [previewReceiptNumber, setPreviewReceiptNumber] = useState("000000-0000");
  useEffect(() => {
    const now = new Date();
    setPreviewDate(
      now.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    );
    setPreviewTime(
      now.toLocaleTimeString("en-MY", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    );
    setPreviewReceiptNumber(
      now.getFullYear().toString().slice(-2) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        "-" +
        ((Math.floor(now.getSeconds() * 4097) % 9000) + 1000).toString(),
    );
  }, []);

  async function handleLogoFile(file: File) {
    setSaveError(null);
    setLogoBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/settings/branding/logo", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json?.message ?? json?.error ?? "Upload failed");
        return;
      }
      setLogoUrl(json.logo_url);
      router.refresh();
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    setSaveError(null);
    setLogoBusy(true);
    try {
      const res = await fetch("/api/settings/branding/logo", {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveError(json?.message ?? "Remove failed");
        return;
      }
      setLogoUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    if (!HEX_COLOR_REGEX.test(primary) || !HEX_COLOR_REGEX.test(accent)) {
      setSaveError("Brand colours must be 6-digit hex values like #5B8C5A.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/settings/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          brand_primary_hex: primary,
          brand_accent_hex: accent,
          registration_no: registrationNo.trim() || null,
          sst_number: sstNumber.trim() || null,
          contact_line: contactLine.trim() || null,
          receipt_footer: receiptFooter.trim() || null,
          email_from_name: emailFromName.trim() || null,
          email_reply_to: emailReplyTo.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(json?.message ?? json?.error ?? "Save failed");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  const disabled = !canEdit || pending;

  return (
    <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-3 lg:items-start">
      {/* LEFT — editor */}
      <div className="space-y-5 lg:col-span-2">
        {/* Logo */}
        <div className="space-y-4 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <ImageIcon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Logo
                </h3>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  PNG / JPEG / SVG / WebP · max 1.5 MB · square crop preferred
                </p>
              </div>
            </div>
            <Badge tone={logoUrl ? "success" : "neutral"}>
              {logoUrl ? "Uploaded" : "Default"}
            </Badge>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-cream-300 bg-cream-100/60 dark:border-hairline-dark dark:bg-hairline-dark/30">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Preview
                </span>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-ink-muted dark:text-cream-400">
                Shown on the sign-in screen, every receipt / invoice header,
                and the public booking page.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoFile(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || logoBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-600 disabled:opacity-60"
                >
                  {logoBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <Upload className="h-4 w-4" strokeWidth={2} />
                  )}
                  {logoUrl ? "Replace logo" : "Upload logo"}
                </button>
                {logoUrl ? (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={disabled || logoBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-card hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Colour palette */}
        <div className="space-y-4 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
              <Palette className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                Colour palette
              </h3>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Two colours drive every surface: primary for navigation,
                accent for CTAs.
              </p>
            </div>
          </div>
          <Swatches
            title="Primary"
            swatches={PRIMARY_SWATCHES}
            value={primary}
            onChange={setPrimary}
            disabled={disabled}
          />
          <Swatches
            title="Accent"
            swatches={ACCENT_SWATCHES}
            value={accent}
            onChange={setAccent}
            disabled={disabled}
          />
        </div>

        {/* Business identity */}
        <div className="space-y-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Receipt className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                Receipt &amp; invoice header
              </h3>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Shown on every POS receipt and Finance invoice export.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Business name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={disabled}
                className={inputCx}
              />
            </Field>
            <Field label="Registration / SSM no.">
              <input
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                disabled={disabled}
                className={inputCx}
              />
            </Field>
            <Field label="SST registration">
              <input
                value={sstNumber}
                onChange={(e) => setSstNumber(e.target.value)}
                disabled={disabled}
                className={inputCx}
              />
            </Field>
            <Field label="Contact line">
              <input
                value={contactLine}
                onChange={(e) => setContactLine(e.target.value)}
                disabled={disabled}
                placeholder="hello@example.com · +60 12-345 6789"
                className={inputCx}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Footer message">
                <textarea
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  disabled={disabled}
                  rows={2}
                  className={`${inputCx} resize-y`}
                  placeholder="Thanks for shopping with us — find us on TikTok @your-handle"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Email identity */}
        <div className="space-y-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Mail className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                Email identity
              </h3>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                From-name and signature used on every customer broadcast.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From name">
              <input
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
                disabled={disabled}
                className={inputCx}
              />
            </Field>
            <Field label="Reply-to address">
              <input
                value={emailReplyTo}
                onChange={(e) => setEmailReplyTo(e.target.value)}
                disabled={disabled}
                type="email"
                className={inputCx}
              />
            </Field>
          </div>
        </div>

        {/* Save bar */}
        {saveError ? (
          <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
            {saveError}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-5 py-3 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {savedAt
              ? "Saved successfully."
              : "Changes apply to every receipt, invoice, sign-in page, and broadcast email."}
          </p>
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2} />
            )}
            Save branding
          </button>
        </div>
      </div>

      {/* RHS — preview */}
      <aside className="space-y-5 lg:sticky lg:top-6">
        <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
            Receipt preview
          </p>
          <div className="mt-3 space-y-2 rounded-lg border border-cream-200 bg-cream-50 p-4 font-mono text-[11px] leading-snug text-ink dark:border-hairline-dark dark:bg-hairline-dark/30 dark:text-cream-100">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-8 w-8 rounded object-contain"
                />
              ) : (
                <span
                  className="grid h-8 w-8 place-items-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  {(name || "BN").slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <p className="font-bold uppercase">{name || "—"}</p>
                {registrationNo ? (
                  <p className="text-[10px] text-ink-muted">
                    {registrationNo}
                  </p>
                ) : null}
              </div>
            </div>
            <hr className="border-dashed border-cream-300 dark:border-hairline-dark" />
            <div className="space-y-0.5 text-[10px]">
              <p>Receipt #{previewReceiptNumber}</p>
              <p>
                {previewDate} · {previewTime}
              </p>
            </div>
            <hr className="border-dashed border-cream-300 dark:border-hairline-dark" />
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Nasi lemak × 2</span>
                <span>RM 16.00</span>
              </div>
              <div className="flex justify-between">
                <span>Teh tarik × 2</span>
                <span>RM 6.00</span>
              </div>
            </div>
            <hr className="border-dashed border-cream-300 dark:border-hairline-dark" />
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span style={{ color: accent }}>RM 22.00</span>
            </div>
            {sstNumber ? (
              <p className="text-[10px] text-ink-muted">SST: {sstNumber}</p>
            ) : null}
            <hr className="border-dashed border-cream-300 dark:border-hairline-dark" />
            {receiptFooter ? (
              <p className="text-center text-[10px] text-ink-muted">
                {receiptFooter}
              </p>
            ) : null}
            {contactLine ? (
              <p className="text-center text-[10px] text-ink-muted">
                {contactLine}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 text-xs dark:border-brand-800 dark:bg-brand-900/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-200">
            Tip
          </p>
          <p className="mt-1.5 leading-relaxed text-ink dark:text-cream-100">
            Upload a high-resolution SVG logo. We&apos;ll render it crisp
            everywhere — sign-in page, receipts, invoices, public booking
            page, and email broadcasts.
          </p>
        </div>
      </aside>
    </form>
  );
}

function Swatches({
  title,
  swatches,
  value,
  onChange,
  disabled,
}: {
  title: string;
  swatches: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const matched = swatches.find((s) => s.value.toLowerCase() === value.toLowerCase());
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink dark:text-cream-100">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((s) => {
          const selected = s.value.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={s.value}
              type="button"
              title={s.label}
              disabled={disabled}
              onClick={() => onChange(s.value)}
              className={`relative h-10 w-10 rounded-lg border-2 transition-all disabled:opacity-60 ${
                selected
                  ? "border-ink scale-110 dark:border-cream-100"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: s.value }}
            >
              {selected ? (
                <Check
                  className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
                  strokeWidth={3}
                />
              ) : null}
            </button>
          );
        })}
        <label className="ml-1 inline-flex items-center gap-2 rounded-md border border-cream-300 bg-white px-2 py-1 text-xs dark:border-hairline-dark dark:bg-panel-dark">
          <span className="text-ink-subtle">Custom</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-subtle">
        {matched?.label ?? "Custom"}{" "}
        <code className="font-mono">{value.toUpperCase()}</code>
      </p>
    </div>
  );
}

const inputCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-semibold text-ink dark:text-cream-100">
        {label}
      </span>
      {children}
    </label>
  );
}
