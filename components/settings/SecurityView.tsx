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
  LogOut,
  Monitor,
  ShieldCheck,
  ShieldOff,
  Smartphone,
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

interface SessionEntry {
  id: string;
  device_label: string;
  location_label: string | null;
  last_seen_at: string;
  created_at: string;
  is_current: boolean;
}

interface SecurityViewProps {
  email: string;
  lastPasswordChangeAt: string | null;
  initialFactors: Factor[];
  initialAudit: AuditEntry[];
  initialSessions: SessionEntry[];
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
  initialSessions,
}: SecurityViewProps) {
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>(initialFactors);
  const [audit, setAudit] = useState<AuditEntry[]>(initialAudit);
  const [sessions, setSessions] = useState<SessionEntry[]>(initialSessions);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSavedAt, setPwdSavedAt] = useState<number | null>(null);
  const [pwdPending, startPwdTransition] = useTransition();

  const [enrolModal, setEnrolModal] = useState<null | {
    factorId: string;
    qr: string;
    secret: string;
  }>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [twoFaPending, startTwoFaTransition] = useTransition();

  const [sessionsPending, startSessionsTransition] = useTransition();
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsRevokedAt, setSessionsRevokedAt] = useState<number | null>(
    null,
  );

  const verifiedFactor = factors.find((f) => f.status === "verified");
  const twoFaOn = !!verifiedFactor;
  const otherSessions = sessions.filter((s) => !s.is_current);

  async function refreshFactors() {
    const res = await fetch("/api/settings/security/2fa");
    if (res.ok) {
      const json = await res.json();
      setFactors(json.totp ?? []);
    }
  }

  async function refreshSessions() {
    const res = await fetch("/api/settings/security/sessions");
    if (res.ok) {
      const json = await res.json();
      setSessions(json.data ?? []);
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
    if (otherSessions.length === 0) return;
    if (
      !confirm(
        "Sign out all other devices? Other browsers and phones will need to sign in again.",
      )
    )
      return;
    setSessionsError(null);
    startSessionsTransition(async () => {
      const res = await fetch("/api/settings/security/sessions/revoke-all", {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSessionsError(json?.message ?? "Could not revoke sessions.");
        return;
      }
      setSessionsRevokedAt(Date.now());
      await refreshSessions();
      router.refresh();
    });
  }

  useEffect(() => {
    if (!enrolModal) {
      fetch("/api/settings/security/audit?limit=20")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setAudit(j.data));
    }
  }, [enrolModal]);

  return (
    <>
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Two-factor auth"
          value={twoFaOn ? "On" : "Off"}
          tone={twoFaOn ? "success" : "warning"}
          icon={ShieldCheck}
        />
        <SummaryTile
          label="Active sessions"
          value={String(sessions.length)}
          tone="neutral"
          icon={Monitor}
        />
        <SummaryTile
          label="Other devices"
          value={String(otherSessions.length)}
          tone={otherSessions.length > 0 ? "warning" : "success"}
          icon={Smartphone}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          {/* Password */}
          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Password
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                  {lastPasswordChangeAt
                    ? `Last changed ${fmtRelative(lastPasswordChangeAt)}.`
                    : "No password change recorded yet."}{" "}
                  Min 12 characters with upper, lower, and a number.
                </p>
              </div>
            </div>
            <div className="space-y-3 p-5">
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
                <Alert tone="danger">{pwdError}</Alert>
              ) : null}
              {pwdSavedAt ? (
                <Alert tone="success">
                  Password updated. Use &quot;Sign out other devices&quot; if
                  you want to invalidate old sessions.
                </Alert>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[11px] text-ink-subtle">
                  <Eye className="h-3 w-3" strokeWidth={2} />
                  Signed in as{" "}
                  <span className="font-mono text-ink-muted">{email}</span>
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
          </section>

          {/* Authenticator app only */}
          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    Authenticator app
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                    Google Authenticator, Authy, or 1Password — required after
                    every password sign-in.
                  </p>
                </div>
              </div>
              <Badge tone={twoFaOn ? "success" : "warning"}>
                {twoFaOn ? "On" : "Off"}
              </Badge>
            </div>

            <div className="p-5">
              {twoFaOn ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-status-success/30 bg-status-success/10 p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-cream-100">
                      {verifiedFactor?.name ?? "Authenticator"} is active
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                      Enrolled {fmtRelative(verifiedFactor?.created_at ?? "")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={disable2fa}
                    disabled={twoFaPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-status-danger/30 bg-white px-3.5 py-2 text-sm font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-60 dark:bg-panel-dark"
                  >
                    <ShieldOff className="h-4 w-4" strokeWidth={2} />
                    Turn off
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-status-warning/30 bg-status-warning/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#8C5C0A] dark:text-[#F5C97A]"
                      strokeWidth={2}
                    />
                    <div>
                      <p className="text-sm font-semibold text-ink dark:text-cream-100">
                        Protect customer data and financial records
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                        Scan a QR code once, then enter a 6-digit code at each
                        sign-in.
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
                    Set up 2FA
                  </button>
                </div>
              )}

              {twoFaError ? (
                <div className="mt-3">
                  <Alert tone="danger">{twoFaError}</Alert>
                </div>
              ) : null}
            </div>
          </section>

          {/* Active sessions */}
          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-200 p-5 dark:border-hairline-dark">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                  <Monitor className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                    Active sessions
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                    Devices where you are signed in to Bantu Niaga.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={revokeAllSessions}
                disabled={sessionsPending || otherSessions.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-card hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/60"
              >
                {sessionsPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                Sign out other devices
              </button>
            </div>

            {sessions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted dark:text-cream-400">
                No sessions recorded yet. Refresh this page after signing in.
              </p>
            ) : (
              <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-lg ${
                          s.is_current
                            ? "bg-status-success/15 text-status-success"
                            : "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400"
                        }`}
                      >
                        {s.is_current ? (
                          <Monitor className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <Smartphone className="h-4 w-4" strokeWidth={2} />
                        )}
                      </span>
                      <div>
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100">
                          {s.device_label}
                          {s.is_current ? (
                            <Badge tone="success">This device</Badge>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-ink-muted dark:text-cream-400">
                          {s.location_label ?? "Malaysia"} · Last active{" "}
                          {fmtRelative(s.last_seen_at)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        s.is_current
                          ? "text-status-success"
                          : "text-ink-muted dark:text-cream-400"
                      }`}
                    >
                      {s.is_current ? "Active now" : "Signed in"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {sessionsError ? (
              <div className="px-5 pb-4">
                <Alert tone="danger">{sessionsError}</Alert>
              </div>
            ) : null}
            {sessionsRevokedAt ? (
              <div className="px-5 pb-4">
                <Alert tone="success">
                  Other devices have been signed out. Only this browser remains
                  active.
                </Alert>
              </div>
            ) : null}
          </section>
        </div>

        {/* Audit log sidebar */}
        <aside className="space-y-5">
          <section className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-ink dark:text-cream-100">
                  Audit log
                </h3>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Last 20 security events
                </p>
              </div>
              <KeyRound className="h-4 w-4 shrink-0 text-ink-subtle" strokeWidth={2} />
            </div>
            {audit.length === 0 ? (
              <p className="mt-4 text-xs text-ink-muted dark:text-cream-400">
                No events yet. Password changes, 2FA updates, and session
                revokes appear here.
              </p>
            ) : (
              <ul className="mt-4 max-h-[28rem] space-y-2.5 overflow-y-auto pr-1">
                {audit.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-cream-200 px-3 py-2.5 dark:border-hairline-dark"
                  >
                    <p className="text-xs font-semibold text-ink dark:text-cream-100">
                      {actionLabel(a.action)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-subtle">
                      {fmtRelative(a.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 text-xs dark:border-brand-800 dark:bg-brand-900/30">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-200">
              Compliance
            </p>
            <p className="mt-1.5 leading-relaxed text-ink dark:text-cream-100">
              Aligned with PDPA Malaysia 2010. Data is stored in the Supabase
              Singapore region.
            </p>
          </div>
        </aside>
      </div>

      {enrolModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink dark:text-cream-100">
                  Set up authenticator
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
                  Scan the QR code, then enter the 6-digit code to confirm.
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
                Manual entry key:
              </p>
              <code className="select-all rounded bg-cream-100 px-2 py-1 font-mono text-xs text-ink dark:bg-hairline-dark dark:text-cream-100">
                {enrolModal.secret}
              </code>
            </div>

            <div className="mt-4 space-y-2">
              <Field label="6-digit code">
                <input
                  value={twoFaCode}
                  onChange={(e) =>
                    setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="123456"
                  className={`${inputCx} text-center font-mono text-lg tracking-[0.4em]`}
                />
              </Field>
              {twoFaError ? <Alert tone="danger">{twoFaError}</Alert> : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEnrolModal(null)}
                disabled={twoFaPending}
                className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-cream-100 disabled:opacity-60 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
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
                Verify &amp; enable
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "neutral";
  icon: typeof ShieldCheck;
}) {
  const toneClass =
    tone === "success"
      ? "border-status-success/30 bg-status-success/10 text-status-success"
      : tone === "warning"
        ? "border-status-warning/30 bg-status-warning/10 text-[#8C5C0A] dark:text-[#F5C97A]"
        : "border-cream-200 bg-white text-ink dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 shadow-card ${toneClass}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/60 dark:bg-panel-dark/40">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
          {label}
        </p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "danger" | "success";
  children: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "border-status-danger/30 bg-status-danger/10 text-status-danger"
      : "border-status-success/30 bg-status-success/10 text-status-success";
  return (
    <p className={`rounded-md border p-2 text-xs ${cls}`}>{children}</p>
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
