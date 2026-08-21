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
  Eye,
  Image as ImageIcon,
  Loader2,
  Mail,
  Palette,
  Receipt,
  Smartphone,
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
    <form onSubmit={handleSave} className="w-full space-y-4">
      {!canEdit ? (
        <p className="text-xs text-ink-muted dark:text-cream-400">
          Read-only — only the owner can update branding.
        </p>
      ) : null}

      {saveError ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {saveError}
        </div>
      ) : null}

      {savedAt ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-3 py-2 text-sm text-status-success">
          Branding saved.
        </div>
      ) : null}

      <BrandingSection
        icon={ImageIcon}
        title="Logo"
        description={logoUrl ? "Uploaded" : "JPG or PNG · max 1.5 MB"}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cream-200 bg-cream-50 dark:border-hairline-dark dark:bg-hairline-dark/20">
            {logoUrl ? (
               
              <img
                src={logoUrl}
                alt="Your logo"
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-ink-subtle" />
            )}
          </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || logoBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
            >
              {logoBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {logoUrl ? "Change" : "Upload"}
            </button>
            {logoUrl ? (
              <button
                type="button"
                onClick={handleLogoRemove}
                disabled={disabled || logoBusy}
                className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-status-danger dark:border-hairline-dark"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
            {logoUrl ? <Badge tone="success">Saved</Badge> : null}
          </div>
        </div>
      </BrandingSection>

      <BrandingSection
        icon={Palette}
        title="Brand colours"
        description="Main and highlight"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ColourPicker
            title="Main"
            hint="Headers & sign-in"
            swatches={PRIMARY_SWATCHES}
            value={primary}
            onChange={setPrimary}
            disabled={disabled}
          />
          <ColourPicker
            title="Highlight"
            hint="Buttons & totals"
            swatches={ACCENT_SWATCHES}
            value={accent}
            onChange={setAccent}
            disabled={disabled}
          />
        </div>
      </BrandingSection>

      <BrandingPreview
        previewTab={previewTab}
        onPreviewTabChange={setPreviewTab}
        logoUrl={logoUrl}
        displayName={displayName}
        primary={primary}
        accent={accent}
        registrationNo={registrationNo}
        sstNumber={sstNumber}
        contactLine={contactLine}
        receiptFooter={receiptFooter}
        previewDate={previewDate}
        previewTime={previewTime}
        previewReceiptNumber={previewReceiptNumber}
        emailFromName={emailFromName}
        emailReplyTo={emailReplyTo}
      />

      <BrandingSection
            icon={Receipt}
            title="Receipt & invoice"
            description={
              detailsComplete ? "Details complete" : "Name and contact"
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
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
                  hint="Bottom of receipts"
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
          </BrandingSection>

          <BrandingSection
            icon={Smartphone}
            title="DuitNow (POS)"
            description="Static QR at checkout"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <Field label="DuitNow ID" hint="Phone or business ID">
                <input
                  value={duitnowId}
                  onChange={(e) => setDuitnowId(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g. 0123456789"
                  className={inputCx}
                />
              </Field>
              <div className="flex items-center gap-2 sm:flex-col sm:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cream-200 bg-cream-50 dark:border-hairline-dark dark:bg-hairline-dark/20">
                  {duitnowQrUrl ? (
                     
                    <img
                      src={duitnowQrUrl}
                      alt="DuitNow QR"
                      className="h-full w-full object-contain p-0.5"
                    />
                  ) : (
                    <Smartphone className="h-5 w-5 text-ink-subtle" />
                  )}
                </div>
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
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => qrInputRef.current?.click()}
                    disabled={disabled || qrBusy}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
                  >
                    {qrBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {duitnowQrUrl ? "Change" : "QR"}
                  </button>
                  {duitnowQrUrl ? (
                    <button
                      type="button"
                      onClick={handleQrRemove}
                      disabled={disabled || qrBusy}
                      className="inline-flex items-center rounded-lg border border-cream-300 px-2 py-1.5 text-xs text-ink-muted hover:text-status-danger dark:border-hairline-dark"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </BrandingSection>

          <section className="w-full rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <button
              type="button"
              onClick={() => setEmailOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 border-b border-cream-200 p-3 text-left dark:border-hairline-dark"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                    Customer emails
                    <span className="ml-1.5 text-xs font-normal text-ink-muted">
                      Optional
                    </span>
                  </h2>
                  <p className="text-[11px] text-ink-muted dark:text-cream-400">
                    Sender & reply-to
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${emailOpen ? "rotate-180" : ""}`}
              />
            </button>
            {emailOpen ? (
              <div className="grid gap-3 p-3 sm:grid-cols-2">
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
            ) : null}
          </section>

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save changes
          </button>
        </div>
      ) : null}
    </form>
  );
}

function BrandingPreview({
  previewTab,
  onPreviewTabChange,
  logoUrl,
  displayName,
  primary,
  accent,
  registrationNo,
  sstNumber,
  contactLine,
  receiptFooter,
  previewDate,
  previewTime,
  previewReceiptNumber,
  emailFromName,
  emailReplyTo,
}: {
  previewTab: PreviewTab;
  onPreviewTabChange: (tab: PreviewTab) => void;
  logoUrl: string | null;
  displayName: string;
  primary: string;
  accent: string;
  registrationNo: string;
  sstNumber: string;
  contactLine: string;
  receiptFooter: string;
  previewDate: string;
  previewTime: string;
  previewReceiptNumber: string;
  emailFromName: string;
  emailReplyTo: string;
}) {
  return (
    <BrandingSection
      icon={Eye}
      title="Preview"
      description="Receipt · sign-in · email"
    >
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
            onClick={() => onPreviewTabChange(tab.id)}
            className={`flex-1 px-2 py-2 text-[11px] font-semibold transition-colors ${
              previewTab === tab.id
                ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-200"
                : "text-ink-muted hover:text-ink dark:text-cream-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-3">
        <div className="mx-auto max-w-sm">
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
    </BrandingSection>
  );
}

function BrandingSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center gap-2.5 border-b border-cream-200 p-3 dark:border-hairline-dark">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
            {title}
          </h2>
          <p className="truncate text-[11px] text-ink-muted dark:text-cream-400">
            {description}
          </p>
        </div>
      </div>
      <div className="p-3">{children}</div>
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
  return (
    <div className="rounded-lg bg-cream-50/80 p-2.5 dark:bg-hairline-dark/20">
      <p className="text-xs font-semibold text-ink dark:text-cream-100">{title}</p>
      <p className="text-[10px] text-ink-muted dark:text-cream-400">{hint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {swatches.map((s) => {
          const selected = s.value.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={s.value}
              type="button"
              title={s.label}
              disabled={disabled}
              onClick={() => onChange(s.value)}
              className={`relative h-8 w-8 rounded-lg border-2 transition-all disabled:opacity-60 ${
                selected
                  ? "border-ink ring-2 ring-brand-400/50 dark:border-cream-100"
                  : "border-white hover:scale-105 dark:border-hairline-dark"
              }`}
              style={{ backgroundColor: s.value }}
              aria-label={s.label}
            >
              {selected ? (
                <Check
                  className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow"
                  strokeWidth={3}
                />
              ) : null}
            </button>
          );
        })}
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-cream-300 bg-white px-2 py-1 text-[10px] font-medium dark:border-hairline-dark dark:bg-panel-dark">
          <span className="text-ink-muted">Custom</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
            aria-label={`Custom ${title.toLowerCase()}`}
          />
        </label>
      </div>
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
    <div className="w-full rounded-lg border border-cream-200 bg-white p-3 text-sm shadow-sm dark:border-hairline-dark dark:bg-cream-50">
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
        <p className="text-xs text-white/80">Sign in to NiagaX</p>
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
  "w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:placeholder:text-cream-400";

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
      <span className="text-xs font-medium text-ink dark:text-cream-100">
        {label}
      </span>
      {hint ? (
        <span className="block text-[10px] text-ink-muted dark:text-cream-400">
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}
