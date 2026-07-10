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
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mail,
  Receipt,
  Smartphone,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HEX_COLOR_REGEX } from "@/lib/settings/schemas";

const PRIMARY_SWATCHES = [
  { value: "#5B8C5A", label: "Sage green" },
  { value: "#0F4C81", label: "Classic blue" },
  { value: "#B85738", label: "Warm terracotta" },
  { value: "#7D5BA6", label: "Soft purple" },
  { value: "#1F7A8C", label: "Ocean teal" },
  { value: "#1F1F1F", label: "Modern black" },
];

const ACCENT_SWATCHES = [
  { value: "#F4A340", label: "Sunny orange" },
  { value: "#E94E77", label: "Bright pink" },
  { value: "#3FB68C", label: "Fresh mint" },
  { value: "#5E8AC4", label: "Sky blue" },
  { value: "#C2A86B", label: "Soft gold" },
  { value: "#A05BC0", label: "Violet" },
];

const WHERE_SHOWN = [
  { icon: Receipt, label: "Receipts & invoices" },
  { icon: Globe, label: "Booking page" },
  { icon: Smartphone, label: "Sign-in screen" },
  { icon: Mail, label: "Customer emails" },
] as const;

type PreviewTab = "receipt" | "signin" | "email";

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
    duitnow_id: string | null;
    duitnow_qr_url: string | null;
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
  const [duitnowId, setDuitnowId] = useState(initial.duitnow_id ?? "");
  const [duitnowQrUrl, setDuitnowQrUrl] = useState(initial.duitnow_qr_url);

  const [logoBusy, setLogoBusy] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("receipt");
  const [emailOpen, setEmailOpen] = useState(
    Boolean(initial.email_from_name || initial.email_reply_to),
  );
  const [pending, startTransition] = useTransition();

  const [previewDate, setPreviewDate] = useState("—");
  const [previewTime, setPreviewTime] = useState("—");
  const [previewReceiptNumber, setPreviewReceiptNumber] =
    useState("000000-0000");

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

  const detailsComplete = Boolean(
    name.trim() &&
      (registrationNo.trim() || contactLine.trim() || receiptFooter.trim()),
  );

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
        setSaveError(
          json?.message ?? json?.error ?? "Could not upload your logo. Try again.",
        );
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
        setSaveError(json?.message ?? "Could not remove logo.");
        return;
      }
      setLogoUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleQrFile(file: File) {
    setSaveError(null);
    setQrBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/settings/branding/duitnow-qr", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(
          json?.message ?? json?.error ?? "Could not upload DuitNow QR.",
        );
        return;
      }
      setDuitnowQrUrl(json.duitnow_qr_url);
      router.refresh();
    } finally {
      setQrBusy(false);
    }
  }

  async function handleQrRemove() {
    setSaveError(null);
    setQrBusy(true);
    try {
      const res = await fetch("/api/settings/branding/duitnow-qr", {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveError(json?.message ?? "Could not remove DuitNow QR.");
        return;
      }
      setDuitnowQrUrl(null);
      if (qrInputRef.current) qrInputRef.current.value = "";
      router.refresh();
    } finally {
      setQrBusy(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    if (!HEX_COLOR_REGEX.test(primary) || !HEX_COLOR_REGEX.test(accent)) {
      setSaveError("Please pick a colour from the swatches or colour picker.");
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
          duitnow_id: duitnowId.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(json?.message ?? json?.error ?? "Could not save. Try again.");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  const disabled = !canEdit || pending;
  const displayName = name.trim() || "Your business";

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* At-a-glance status */}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatusTile
          label="Logo"
          value={logoUrl ? "Added" : "Not yet"}
          done={Boolean(logoUrl)}
          hint={logoUrl ? "Looks good" : "Upload from your phone or computer"}
        />
        <StatusTile
          label="Brand colours"
          value="Chosen"
          done
          hint="Main + highlight colour selected"
        />
        <StatusTile
          label="Business details"
          value={detailsComplete ? "Filled in" : "Add more"}
          done={detailsComplete}
          hint="Name, contact & thank-you message"
        />
      </section>

      {/* Where this appears */}
      <div className="flex flex-wrap gap-2">
        {WHERE_SHOWN.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-white px-3 py-1 text-xs text-ink-muted dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-400"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            {label}
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* Editor — step-by-step */}
        <div className="space-y-5">
          {!canEdit ? (
            <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-[#8C5C0A] dark:text-[#F5C97A]">
              You can preview your branding here. Only the business owner can make
              changes.
            </div>
          ) : null}

          {/* Step 1 — Logo */}
          <StepCard
            step={1}
            title="Add your logo"
            description="A clear square logo works best. Customers will see it on receipts, invoices, and your booking page."
          >
            <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-cream-300 bg-cream-50/80 p-6 dark:border-hairline-dark dark:bg-hairline-dark/20 sm:flex-row sm:items-start">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm dark:border-hairline-dark dark:bg-panel-dark">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Your logo"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="text-center px-2">
                    <ImageIcon className="mx-auto h-8 w-8 text-ink-subtle" />
                    <p className="mt-2 text-[11px] text-ink-muted">No logo yet</p>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <p className="text-sm text-ink-muted dark:text-cream-400">
                  Tap below to choose a photo from your gallery or files. JPG and
                  PNG are fine — max 1.5 MB.
                </p>
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
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || logoBusy}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {logoBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {logoUrl ? "Change logo" : "Choose logo"}
                  </button>
                  {logoUrl ? (
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      disabled={disabled || logoBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-status-danger dark:border-hairline-dark"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
                {logoUrl ? (
                  <Badge tone="success">Logo saved</Badge>
                ) : null}
              </div>
            </div>
          </StepCard>

          {/* Step 2 — Colours */}
          <StepCard
            step={2}
            title="Pick your brand colours"
            description="Choose two colours that match your shop or brand. You can tap a preset or use “Pick your own”."
          >
            <div className="space-y-5">
              <ColourPicker
                title="Main colour"
                hint="Menus, headers, and your sign-in page"
                swatches={PRIMARY_SWATCHES}
                value={primary}
                onChange={setPrimary}
                disabled={disabled}
              />
              <ColourPicker
                title="Highlight colour"
                hint="Buttons, totals, and important highlights"
                swatches={ACCENT_SWATCHES}
                value={accent}
                onChange={setAccent}
                disabled={disabled}
              />
            </div>
          </StepCard>

          {/* Step 3 — Receipt details */}
          <StepCard
            step={3}
            title="Details on receipts & invoices"
            description="This information prints at the top and bottom of every receipt and invoice."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Business name"
                hint="As you want customers to see it"
              >
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. Kedai Runcit Ali"
                  className={inputCx}
                />
              </Field>
              <Field
                label="SSM number"
                hint="Optional — your company registration"
              >
                <input
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. 202301234567"
                  className={inputCx}
                />
              </Field>
              <Field label="SST number" hint="Only if you are SST-registered">
                <input
                  value={sstNumber}
                  onChange={(e) => setSstNumber(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. W10-1808-32000001"
                  className={inputCx}
                />
              </Field>
              <Field
                label="Phone or email"
                hint="Shown on receipts so customers can reach you"
              >
                <input
                  value={contactLine}
                  onChange={(e) => setContactLine(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. +60 12-345 6789"
                  className={inputCx}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Thank-you message"
                  hint="A short line at the bottom of receipts"
                >
                  <textarea
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    disabled={disabled}
                    rows={2}
                    className={`${inputCx} resize-y`}
                    placeholder="e.g. Terima kasih — jumpa lagi!"
                  />
                </Field>
              </div>
            </div>
          </StepCard>

          {/* Step 4 — DuitNow (POS / invoices) */}
          <StepCard
            step={4}
            title="DuitNow for POS"
            description="Set once — your static QR shows at checkout when customers pay by DuitNow. Dynamic amount QR is a Sales add-on later."
          >
            <div className="space-y-4">
              <Field
                label="DuitNow ID"
                hint="Phone or business ID customers can transfer to"
              >
                <input
                  value={duitnowId}
                  onChange={(e) => setDuitnowId(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. 0123456789"
                  className={inputCx}
                />
              </Field>
              <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-cream-300 bg-cream-50/80 p-5 dark:border-hairline-dark dark:bg-hairline-dark/20 sm:flex-row sm:items-start">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark">
                  {duitnowQrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={duitnowQrUrl}
                      alt="DuitNow QR"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <Smartphone className="h-8 w-8 text-ink-subtle" />
                  )}
                </div>
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <p className="text-sm text-ink-muted dark:text-cream-400">
                    Upload the QR image from your bank or DuitNow app. PNG or
                    JPG — max 1.5 MB.
                  </p>
                  <input
                    ref={qrInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleQrFile(f);
                    }}
                  />
                  <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                    <button
                      type="button"
                      onClick={() => qrInputRef.current?.click()}
                      disabled={disabled || qrBusy}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {qrBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {duitnowQrUrl ? "Change QR" : "Upload QR"}
                    </button>
                    {duitnowQrUrl ? (
                      <button
                        type="button"
                        onClick={handleQrRemove}
                        disabled={disabled || qrBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-status-danger dark:border-hairline-dark"
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </StepCard>

          {/* Step 5 — Email (collapsible) */}
          <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <button
              type="button"
              onClick={() => setEmailOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="flex items-start gap-3">
                <StepBadge step={5} />
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    Customer emails
                    <span className="ml-2 text-xs font-normal text-ink-muted">
                      Optional
                    </span>
                  </h3>
                  <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
                    How your name appears when you email customers
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-ink-subtle transition-transform ${emailOpen ? "rotate-180" : ""}`}
              />
            </button>
            {emailOpen ? (
              <div className="border-t border-cream-200 px-5 pb-5 pt-4 dark:border-hairline-dark">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Sender name"
                    hint="e.g. Ali from Kedai Runcit Ali"
                  >
                    <input
                      value={emailFromName}
                      onChange={(e) => setEmailFromName(e.target.value)}
                      disabled={disabled}
                      placeholder={displayName}
                      className={inputCx}
                    />
                  </Field>
                  <Field
                    label="Reply email"
                    hint="Where replies from customers go"
                  >
                    <input
                      value={emailReplyTo}
                      onChange={(e) => setEmailReplyTo(e.target.value)}
                      disabled={disabled}
                      type="email"
                      placeholder="hello@yourbusiness.com"
                      className={inputCx}
                    />
                  </Field>
                </div>
              </div>
            ) : null}
          </div>

          {saveError ? (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {saveError}
            </div>
          ) : null}

          {savedAt ? (
            <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
              Your branding has been saved. Customers will see the updates on new
              receipts and emails.
            </div>
          ) : null}

          <div className="flex flex-col gap-3 rounded-xl border border-cream-200 bg-white px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              {canEdit
                ? "Tap save when you are happy with how everything looks."
                : "Contact your business owner to update branding."}
            </p>
            {canEdit ? (
              <button
                type="submit"
                disabled={disabled}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save changes
              </button>
            ) : null}
          </div>
        </div>

        {/* Live preview */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Live preview
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                See how customers will see your brand
              </p>
            </div>

            <div className="flex border-b border-cream-200 dark:border-hairline-dark">
              {(
                [
                  { id: "receipt" as const, label: "Receipt" },
                  { id: "signin" as const, label: "Sign-in" },
                  { id: "email" as const, label: "Email" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewTab(tab.id)}
                  className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors ${
                    previewTab === tab.id
                      ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-200"
                      : "text-ink-muted hover:text-ink dark:text-cream-400"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {previewTab === "receipt" ? (
                <ReceiptPreview
                  logoUrl={logoUrl}
                  name={displayName}
                  primary={primary}
                  accent={accent}
                  registrationNo={registrationNo}
                  sstNumber={sstNumber}
                  contactLine={contactLine}
                  receiptFooter={receiptFooter}
                  previewDate={previewDate}
                  previewTime={previewTime}
                  previewReceiptNumber={previewReceiptNumber}
                />
              ) : null}
              {previewTab === "signin" ? (
                <SignInPreview
                  logoUrl={logoUrl}
                  name={displayName}
                  primary={primary}
                />
              ) : null}
              {previewTab === "email" ? (
                <EmailPreview
                  logoUrl={logoUrl}
                  name={displayName}
                  primary={primary}
                  accent={accent}
                  fromName={emailFromName || displayName}
                  replyTo={emailReplyTo}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/30">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-200" />
              <div>
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-100">
                  Quick tip
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink dark:text-cream-200">
                  Use your real shop logo and colours — customers recognise your
                  brand on receipts, WhatsApp messages, and your online booking
                  page.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

function StatusTile({
  label,
  value,
  done,
  hint,
}: {
  label: string;
  value: string;
  done: boolean;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
          {label}
        </p>
        {done ? (
          <Check className="h-4 w-4 text-status-success" strokeWidth={2.5} />
        ) : null}
      </div>
      <p className="mt-1 text-lg font-bold text-ink dark:text-cream-100">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">{hint}</p>
    </div>
  );
}

function StepBadge({ step }: { step: number }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
      {step}
    </span>
  );
}

function StepCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start gap-3 border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
        <StepBadge step={step} />
        <div>
          <h3 className="text-base font-semibold text-ink dark:text-cream-100">
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">
            {description}
          </p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ColourPicker({
  title,
  hint,
  swatches,
  value,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  swatches: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const matched = swatches.find(
    (s) => s.value.toLowerCase() === value.toLowerCase(),
  );
  return (
    <div className="rounded-lg bg-cream-50/80 p-4 dark:bg-hairline-dark/20">
      <p className="text-sm font-semibold text-ink dark:text-cream-100">{title}</p>
      <p className="text-xs text-ink-muted dark:text-cream-400">{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {swatches.map((s) => {
          const selected = s.value.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={s.value}
              type="button"
              title={s.label}
              disabled={disabled}
              onClick={() => onChange(s.value)}
              className={`relative h-11 w-11 rounded-xl border-2 transition-all disabled:opacity-60 ${
                selected
                  ? "border-ink ring-2 ring-brand-400/50 dark:border-cream-100"
                  : "border-white hover:scale-105 dark:border-hairline-dark"
              }`}
              style={{ backgroundColor: s.value }}
              aria-label={s.label}
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
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cream-300 bg-white px-3 py-2 text-xs font-medium dark:border-hairline-dark dark:bg-panel-dark">
          <span className="text-ink-muted">Pick your own</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
            aria-label={`Custom ${title.toLowerCase()}`}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-subtle">
        Selected: <span className="font-medium text-ink dark:text-cream-200">{matched?.label ?? "Your custom colour"}</span>
      </p>
    </div>
  );
}

function ReceiptPreview({
  logoUrl,
  name,
  primary,
  accent,
  registrationNo,
  sstNumber,
  contactLine,
  receiptFooter,
  previewDate,
  previewTime,
  previewReceiptNumber,
}: {
  logoUrl: string | null;
  name: string;
  primary: string;
  accent: string;
  registrationNo: string;
  sstNumber: string;
  contactLine: string;
  receiptFooter: string;
  previewDate: string;
  previewTime: string;
  previewReceiptNumber: string;
}) {
  return (
    <div className="mx-auto max-w-[260px] rounded-lg border border-cream-200 bg-white p-4 text-sm shadow-sm dark:border-hairline-dark dark:bg-cream-50">
      <div className="flex items-center gap-3 border-b border-dashed border-cream-300 pb-3">
        <LogoMark logoUrl={logoUrl} name={name} primary={primary} size="md" />
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{name}</p>
          {registrationNo ? (
            <p className="text-[10px] text-ink-muted">SSM {registrationNo}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1 py-3 text-xs text-ink-muted">
        <p>Receipt #{previewReceiptNumber}</p>
        <p>
          {previewDate} · {previewTime}
        </p>
      </div>
      <div className="space-y-2 border-y border-dashed border-cream-300 py-3 text-sm">
        <div className="flex justify-between">
          <span>Nasi lemak × 2</span>
          <span>RM 16.00</span>
        </div>
        <div className="flex justify-between">
          <span>Teh tarik × 2</span>
          <span>RM 6.00</span>
        </div>
      </div>
      <div
        className="flex justify-between py-3 text-base font-bold"
        style={{ color: accent }}
      >
        <span>Total</span>
        <span>RM 22.00</span>
      </div>
      {sstNumber ? (
        <p className="text-[10px] text-ink-muted">SST no. {sstNumber}</p>
      ) : null}
      {(receiptFooter || contactLine) && (
        <div className="mt-3 space-y-1 border-t border-dashed border-cream-300 pt-3 text-center text-[11px] text-ink-muted">
          {receiptFooter ? <p>{receiptFooter}</p> : null}
          {contactLine ? <p>{contactLine}</p> : null}
        </div>
      )}
      <div
        className="mt-3 h-1 rounded-full"
        style={{ backgroundColor: primary }}
        aria-hidden
      />
    </div>
  );
}

function SignInPreview({
  logoUrl,
  name,
  primary,
}: {
  logoUrl: string | null;
  name: string;
  primary: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-cream-200 dark:border-hairline-dark"
      style={{ backgroundColor: `${primary}18` }}
    >
      <div
        className="px-4 py-6 text-center"
        style={{ backgroundColor: primary }}
      >
        <div className="mx-auto flex justify-center">
          <LogoMark logoUrl={logoUrl} name={name} primary={primary} size="lg" />
        </div>
        <p className="mt-3 text-sm font-semibold text-white">{name}</p>
        <p className="text-xs text-white/80">Sign in to Bantu Niaga</p>
      </div>
      <div className="space-y-2 bg-white p-4 dark:bg-panel-dark">
        <div className="h-9 rounded-lg bg-cream-100 dark:bg-hairline-dark/40" />
        <div className="h-9 rounded-lg bg-cream-100 dark:bg-hairline-dark/40" />
        <div
          className="h-9 rounded-lg"
          style={{ backgroundColor: primary }}
        />
      </div>
    </div>
  );
}

function EmailPreview({
  logoUrl,
  name,
  primary,
  accent,
  fromName,
  replyTo,
}: {
  logoUrl: string | null;
  name: string;
  primary: string;
  accent: string;
  fromName: string;
  replyTo: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-cream-200 bg-white dark:border-hairline-dark dark:bg-panel-dark">
      <div className="border-b border-cream-200 px-3 py-2 text-[10px] text-ink-muted dark:border-hairline-dark">
        <p>
          <span className="font-semibold">From:</span> {fromName}
        </p>
        {replyTo ? (
          <p>
            <span className="font-semibold">Reply:</span> {replyTo}
          </p>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <LogoMark logoUrl={logoUrl} name={name} primary={primary} size="sm" />
          <span className="text-sm font-semibold" style={{ color: primary }}>
            {name}
          </span>
        </div>
        <p className="mt-3 text-sm text-ink dark:text-cream-100">
          Hi Ahmad, your order is ready for collection.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg px-4 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          View order
        </button>
      </div>
    </div>
  );
}

function LogoMark({
  logoUrl,
  name,
  primary,
  size,
}: {
  logoUrl: string | null;
  name: string;
  primary: string;
  size: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-8 w-8" : size === "md" ? "h-12 w-12" : "h-16 w-16";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={`${dim} rounded-lg object-contain bg-white`}
      />
    );
  }
  return (
    <span
      className={`${dim} grid place-items-center rounded-lg text-xs font-bold text-white`}
      style={{ backgroundColor: primary }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

const inputCx =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-semibold text-ink dark:text-cream-100">
        {label}
      </span>
      {hint ? (
        <span className="block text-xs text-ink-muted dark:text-cream-400">
          {hint}
        </span>
      ) : null}
      <div className="pt-1">{children}</div>
    </label>
  );
}
