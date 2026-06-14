"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Monitor,
  ShieldCheck,
  ShieldOff,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Factor {
  id: string;
  name: string;
  status: "verified" | "unverified";
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  diff: unknown;
  created_at: string;
  actor_user_id: string | null;
}

interface SecurityViewProps {
  email: string;
  lastPasswordChangeAt: string | null;
  initialFactors: Factor[];
  initialAudit: AuditEntry[];
  currentDevice: {
    label: string;
    location: string;
  };
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function actionLabel(action: string): string {
  return action
    .replace(/^settings\./, "")
    .replace(/^billing\./, "Billing · ")
    .replace(/^security\./, "Security · ")
    .replace(/^subscription\./, "Subscription · ")
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function SecurityView({
  email,
  lastPasswordChangeAt,
  initialFactors,
  initialAudit,
  currentDevice,
}: SecurityViewProps) {
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>(initialFactors);
  const [audit, setAudit] = useState<AuditEntry[]>(initialAudit);

  // Password form
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSavedAt, setPwdSavedAt] = useState<number | null>(null);
  const [pwdPending, startPwdTransition] = useTransition();

  // 2FA enrol modal
  const [enrolModal, setEnrolModal] = useState<null | {
    factorId: string;
    qr: string;
    secret: string;
  }>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [twoFaPending, startTwoFaTransition] = useTransition();

  // Sessions revoke
  const [sessionsPending, startSessionsTransition] = useTransition();
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsRevokedAt, setSessionsRevokedAt] = useState<number | null>(
    null,
  );

  const verifiedFactor = factors.find((f) => f.status === "verified");
  const twoFaOn = !!verifiedFactor;

  async function refreshFactors() {
    const res = await fetch("/api/settings/security/2fa");
    if (res.ok) {
      const json = await res.json();
      setFactors(json.totp ?? []);
    }
  }

  function changePassword() {
    setPwdError(null);
    if (!currentPwd || !newPwd) {
      setPwdError("Fill both fields.");
      return;
    }
    startPwdTransition(async () => {
      const res = await fetch("/api/settings/security/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPwd,
          new_password: newPwd,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.issues?.[0]?.message) {
          setPwdError(json.issues[0].message);
        } else {
          setPwdError(json?.message ?? "Could not change password.");
        }
        return;
      }
      setCurrentPwd("");
      setNewPwd("");
      setPwdSavedAt(Date.now());
      router.refresh();
    });
  }

  function startEnrol() {
    setTwoFaError(null);
    startTwoFaTransition(async () => {
      const res = await fetch("/api/settings/security/2fa/enroll", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setTwoFaError(json?.message ?? "Could not start 2FA enrolment.");
        return;
      }
      setEnrolModal({
        factorId: json.factor_id,
        qr: json.qr_code,
        secret: json.secret,
      });
    });
  }

  function verifyEnrol() {
    if (!enrolModal) return;
    setTwoFaError(null);
    if (!/^\d{6}$/.test(twoFaCode)) {
      setTwoFaError("Enter the 6-digit code from your authenticator.");
      return;
    }
    startTwoFaTransition(async () => {
      const res = await fetch("/api/settings/security/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factor_id: enrolModal.factorId,
          code: twoFaCode,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTwoFaError(json?.message ?? "Verification failed.");
        return;
      }
      setEnrolModal(null);
      setTwoFaCode("");
      await refreshFactors();
      router.refresh();
    });
  }

  function disable2fa() {
    if (!verifiedFactor) return;
    if (
      !confirm(
        "Turn off two-factor auth? Your account will be protected by password only.",
      )
    )
      return;
    setTwoFaError(null);
    startTwoFaTransition(async () => {
      const res = await fetch("/api/settings/security/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factor_id: verifiedFactor.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setTwoFaError(json?.message ?? "Could not disable 2FA.");
        return;
      }
      await refreshFactors();
      router.refresh();
    });
  }

  function revokeAllSessions() {
    if (
      !confirm("Sign out everywhere except this device? Other browsers will be signed out.")
    )
      return;
    setSessionsError(null);
    startSessionsTransition(async () => {
      const res = await fetch(
        "/api/settings/security/sessions/revoke-all",
        { method: "POST" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSessionsError(json?.message ?? "Could not revoke sessions.");
        return;
      }
      setSessionsRevokedAt(Date.now());
      router.refresh();
    });
  }

  // After enrol, refresh audit/factors when the modal closes.
  useEffect(() => {
    if (!enrolModal) {
      // also pull latest audit
      fetch("/api/settings/security/audit?limit=20")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setAudit(j.data));
    }
  }, [enrolModal]);

  return (
    <>
      {/* Risk banner — only show when 2FA off */}
      {!twoFaOn ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-status-warning/30 bg-status-warning/15 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-status-warning/30 text-[#8C5C0A] dark:text-[#F5C97A]">
              <AlertTriangle className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Two-factor auth is off.
              </p>
              <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                Enable 2FA to protect customer data, financial records, and
                integrations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={startEnrol}
            disabled={twoFaPending}
            className="inline-flex items-center gap-2 rounded-lg bg-status-warning px-4 py-2 text-sm font-semibold text-[#5C3A05] shadow-card hover:bg-[#E6B452] disabled:opacity-60"
          >
            {twoFaPending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
            )}
            Enable 2FA
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-status-success/30 bg-status-success/10 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-status-success/20 text-status-success">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                Two-factor auth is active.
              </p>
              <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                {verifiedFactor?.name ?? "Authenticator"} · added{" "}
                {fmtRelative(verifiedFactor?.created_at ?? new Date().toISOString())}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={disable2fa}
            disabled={twoFaPending}
            className="inline-flex items-center gap-2 rounded-lg border border-status-danger/30 bg-white px-4 py-2 text-sm font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-60 dark:bg-panel-dark"
          >
            <ShieldOff className="h-4 w-4" strokeWidth={2} />
            Disable 2FA
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          {/* 2FA detail card */}
          <div className="space-y-4 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    Two-factor authentication
                  </h3>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    Add a code from your authenticator app after every
                    password sign-in.
                  </p>
                </div>
              </div>
              <Badge tone={twoFaOn ? "success" : "warning"}>
                {twoFaOn ? "On" : "Off"}
              </Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  label: "Authenticator app",
                  caption: "Google Authenticator, Authy, 1Password",
                  active: twoFaOn,
                },
                {
                  label: "SMS code",
                  caption: "Coming with WhatsApp Business",
                  active: false,
                },
                {
                  label: "Hardware key",
                  caption: "YubiKey, Titan",
                  active: false,
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-cream-200 p-3 dark:border-hairline-dark"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink dark:text-cream-100">
                      {m.label}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                      {m.active ? "On" : "Off"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-muted dark:text-cream-400">
                    {m.caption}
                  </p>
                </div>
              ))}
            </div>

            {twoFaError ? (
              <p className="rounded-md border border-status-danger/30 bg-status-danger/10 p-2 text-xs text-status-danger">
                {twoFaError}
              </p>
            ) : null}
          </div>

          {/* Password card */}
          <div className="space-y-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Password
                </h3>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  {lastPasswordChangeAt
                    ? `Last changed ${fmtRelative(lastPasswordChangeAt)}.`
                    : "Set a fresh password to enable change tracking."}{" "}
                  Min 12 characters · upper + lower + number.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Current password">
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="••••••••••"
                  className={inputCx}
                />
              </Field>
              <Field label="New password">
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Min 12 characters"
                  className={inputCx}
                />
              </Field>
            </div>
            {pwdError ? (
              <p className="rounded-md border border-status-danger/30 bg-status-danger/10 p-2 text-xs text-status-danger">
                {pwdError}
              </p>
            ) : null}
            {pwdSavedAt ? (
              <p className="rounded-md border border-status-success/30 bg-status-success/10 p-2 text-xs text-status-success">
                Password updated. Sign out and back in on other devices.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-[11px] text-ink-subtle">
                <Eye className="h-3 w-3" strokeWidth={2} />
                Other sessions stay valid — use the panel below to revoke
                them.
              </p>
              <button
                type="button"
                onClick={changePassword}
                disabled={pwdPending || !currentPwd || !newPwd}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
              >
                {pwdPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2} />
                )}
                Update password
              </button>
            </div>
          </div>

          {/* Sessions */}
          <div className="space-y-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Active sessions
                </h3>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Account: <span className="font-mono">{email}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={revokeAllSessions}
                disabled={sessionsPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                {sessionsPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                ) : null}
                Sign out other devices
              </button>
            </div>
            <ul className="rounded-lg border border-cream-200 dark:border-hairline-dark">
              <li className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                    <Monitor className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100">
                      {currentDevice.label}
                      <Badge tone="success">Current</Badge>
                    </p>
                    <p className="text-[11px] text-ink-muted dark:text-cream-400">
                      {currentDevice.location} · Active now
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-status-success">
                  Active
                </span>
              </li>
            </ul>
            {sessionsError ? (
              <p className="rounded-md border border-status-danger/30 bg-status-danger/10 p-2 text-xs text-status-danger">
                {sessionsError}
              </p>
            ) : null}
            {sessionsRevokedAt ? (
              <p className="rounded-md border border-status-success/30 bg-status-success/10 p-2 text-xs text-status-success">
                Other sessions signed out.
              </p>
            ) : null}
            <p className="text-[11px] text-ink-muted dark:text-cream-400">
              Supabase doesn&apos;t expose a per-device session list yet — we
              rotate all refresh tokens except this browser&apos;s when you
              click <em>Sign out other devices</em>.
            </p>
          </div>
        </div>

        {/* RHS — audit log */}
        <aside className="space-y-5">
          <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Audit log
                </h3>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Last 20 events · admin-visible
                </p>
              </div>
              <KeyRound className="h-4 w-4 text-ink-subtle" strokeWidth={2} />
            </div>
            {audit.length === 0 ? (
              <p className="mt-3 text-xs text-ink-muted dark:text-cream-400">
                No audit events yet. Actions you take in Bantu Niaga will
                appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5">
                    <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-status-success/20 text-status-success">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink dark:text-cream-100">
                        {actionLabel(a.action)}
                      </p>
                      <p className="text-[10px] text-ink-subtle">
                        {fmtRelative(a.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 text-xs dark:border-brand-800 dark:bg-brand-900/30">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-200">
              Compliance
            </p>
            <p className="mt-1.5 leading-relaxed text-ink dark:text-cream-100">
              Bantu Niaga is aligned with PDPA Malaysia 2010 and Bank Negara
              data-residency guidelines. All data is stored in the Supabase
              Singapore region.
            </p>
          </div>
        </aside>
      </div>

      {/* 2FA enrol modal */}
      {enrolModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink dark:text-cream-100">
                  Set up 2FA
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                  Scan the QR with Google Authenticator, Authy, or 1Password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrolModal(null)}
                aria-label="Close"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark/40"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="rounded-xl border border-cream-200 bg-white p-3 dark:border-hairline-dark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrolModal.qr}
                  alt="2FA QR code"
                  className="h-44 w-44"
                />
              </div>
              <p className="text-[11px] text-ink-muted dark:text-cream-400">
                Or enter the code manually:
              </p>
              <code className="select-all rounded bg-cream-100 px-2 py-1 font-mono text-xs text-ink dark:bg-hairline-dark dark:text-cream-100">
                {enrolModal.secret}
              </code>
            </div>

            <div className="mt-4 space-y-2">
              <Field label="Enter the 6-digit code">
                <input
                  value={twoFaCode}
                  onChange={(e) =>
                    setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="123 456"
                  className={`${inputCx} tracking-[0.5em] text-center font-mono text-lg`}
                />
              </Field>
              {twoFaError ? (
                <p className="rounded-md border border-status-danger/30 bg-status-danger/10 p-2 text-xs text-status-danger">
                  {twoFaError}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEnrolModal(null)}
                disabled={twoFaPending}
                className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={verifyEnrol}
                disabled={twoFaPending || twoFaCode.length !== 6}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-accent-600 disabled:opacity-60"
              >
                {twoFaPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2} />
                )}
                Verify &amp; turn on
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
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
