"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  History,
  Loader2,
  Mail,
  Plus,
  Shield,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  INVITEABLE_ROLES,
  ROLE_HINTS,
  ROLE_LABELS,
  ROLES,
  roleSummary,
  type InviteableRole,
  type TeamInviteRow,
  type TeamMemberRow,
} from "@/lib/settings/team-shared";
import { PILLARS, permissions, type Role } from "@/lib/permissions";

interface TeamAuditEntry {
  id: string;
  action: string;
  created_at: string;
}

interface TeamViewProps {
  members: TeamMemberRow[];
  invites: TeamInviteRow[];
  audit: TeamAuditEntry[];
  auditTotal: number;
  seatQuota: number;
  seatUsed: number;
  canEdit: boolean;
  currentUserId: string;
  showBillingLink: boolean;
}

const PILLAR_LABELS: Record<(typeof PILLARS)[number], string> = {
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  marketing: "Marketing",
  sales: "Sales",
  hr: "HR",
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pillarAccessLabel(
  role: Role,
  pillar: (typeof PILLARS)[number],
): string {
  const access = permissions[role][pillar];
  if (access === "*") return "Full";
  if (access === undefined) return "—";
  const keys = Object.keys(access);
  if (keys.length === 0) return "Limited";
  return "Limited";
}

function auditActionLabel(action: string): string {
  switch (action) {
    case "team.invite":
      return "Invite sent";
    case "team.invite_cancel":
      return "Invite cancelled";
    case "team.role_change":
      return "Role changed";
    case "team.member_remove":
      return "Member removed";
    case "auth.sign_up":
      return "Account created";
    default:
      return action.replace(/\./g, " · ");
  }
}

function memberStatus(member: TeamMemberRow): {
  label: string;
  tone: "success" | "warning" | "neutral";
} {
  if (member.last_password_change_at) {
    return { label: "Active", tone: "success" };
  }
  return { label: "Pending sign-in", tone: "warning" };
}

export function TeamView({
  members,
  invites,
  audit,
  auditTotal,
  seatQuota: quota,
  seatUsed,
  canEdit,
  currentUserId,
  showBillingLink,
}: TeamViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteableRole>("staff");
  const [previewRole, setPreviewRole] = useState<Role>("staff");

  const atSeatLimit = quota < 999 && seatUsed >= quota;

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role === "owner") return -1;
        if (b.role === "owner") return 1;
        return a.display_name?.localeCompare(b.display_name ?? "") ?? 0;
      }),
    [members],
  );

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            email: inviteEmail,
            role: inviteRole,
            display_name: inviteName.trim() || undefined,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.message ?? json.error ?? "Could not send invite.");
          return;
        }
        const sentTo = inviteEmail.trim();
        setInviteOpen(false);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("staff");
        if (json.reattached_existing) {
          setSuccess(
            json.message ??
              `${sentTo} was re-added. They can sign in with their existing password.`,
          );
        } else if (json.invite_email_sent) {
          setSuccess(
            `Invite email sent to ${sentTo}. They can set a password from the link (valid ~1 hour).`,
          );
        } else if (json.dev_bypass && json.dev_invite_link) {
          setSuccess(
            `Join link (email not sent — check RESEND / Supabase SMTP): ${json.dev_invite_link}`,
          );
        } else if (json.join_link || json.dev_invite_link) {
          setSuccess(
            `Invite ready for ${sentTo}. Share this join link: ${json.join_link ?? json.dev_invite_link}`,
          );
        } else {
          setSuccess(
            `Invite created for ${sentTo}. Ask them to check email, or share a new invite if nothing arrives.`,
          );
        }
        router.refresh();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  async function changeRole(memberId: string, role: InviteableRole) {
    clearMessages();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/team/members/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ role }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.message ?? json.error ?? "Could not update role.");
          return;
        }
        setSuccess("Role updated.");
        router.refresh();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  async function removeMember(memberId: string, name: string) {
    if (
      !confirm(`Remove ${name} from your team? They will lose access immediately.`)
    ) {
      return;
    }
    clearMessages();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/team/members/${memberId}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.message ?? json.error ?? "Could not remove member.");
          return;
        }
        setSuccess("Member removed.");
        router.refresh();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  async function cancelInvite(inviteId: string, email: string) {
    if (!confirm(`Cancel the invite for ${email}?`)) return;
    clearMessages();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/team/invites/${inviteId}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.message ?? json.error ?? "Could not cancel invite.");
          return;
        }
        setSuccess("Invite cancelled.");
        router.refresh();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {success}
        </div>
      ) : null}

      {!canEdit ? (
        <p className="text-sm text-ink-muted dark:text-cream-400">
          Read-only — only the owner can invite, change roles, or revoke access.
        </p>
      ) : null}

      <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Users className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Members
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {members.length} active
              </p>
            </div>
          </div>
          {canEdit ? (
            <button
              type="button"
              disabled={pending || atSeatLimit}
              onClick={() => {
                clearMessages();
                setInviteOpen(true);
                setPreviewRole(inviteRole);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Invite member
            </button>
          ) : null}
        </div>

        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
          {sortedMembers.map((member) => {
            const status = memberStatus(member);
            const isSelf = member.id === currentUserId;
            const isOwner = member.role === "owner";
            const display = member.display_name ?? member.email ?? "Unknown";

            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                      {display}
                      {isSelf ? (
                        <span className="ml-1.5 text-xs font-normal text-ink-muted">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    {isOwner ? (
                      <Badge tone="accent">
                        <Crown className="mr-1 inline h-3 w-3" />
                        Owner
                      </Badge>
                    ) : (
                      <Badge tone="brand">{ROLE_LABELS[member.role]}</Badge>
                    )}
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-cream-400">
                    {member.email ?? "No email"} · joined{" "}
                    {fmtDate(member.created_at)}
                  </p>
                </div>

                {canEdit && !isOwner && !isSelf ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={member.role}
                      disabled={pending}
                      onChange={(e) =>
                        changeRole(member.id, e.target.value as InviteableRole)
                      }
                      className="rounded-lg border border-cream-300 bg-white px-2 py-1.5 text-xs dark:border-hairline-dark dark:bg-panel-dark"
                      aria-label={`Role for ${display}`}
                    >
                      {INVITEABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeMember(member.id, display)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-cream-300 text-ink-muted hover:border-status-danger/40 hover:text-status-danger dark:border-hairline-dark"
                      aria-label={`Remove ${display}`}
                    >
                      <UserMinus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {invites.length > 0 ? (
        <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <div className="flex items-center gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <Mail className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Pending invites
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {invites.length} waiting to accept
              </p>
            </div>
          </div>
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                    {invite.display_name ?? invite.email}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-cream-400">
                    {invite.email} · {ROLE_LABELS[invite.role]} · expires{" "}
                    {fmtDate(invite.expires_at)}
                  </p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => cancelInvite(invite.id, invite.email)}
                    className="shrink-0 rounded-md border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink-muted hover:border-status-danger/40 hover:text-status-danger dark:border-hairline-dark"
                  >
                    Cancel
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-center gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <Shield className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Role permissions
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Preview what each role can access
            </p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <select
            value={previewRole}
            onChange={(e) => setPreviewRole(e.target.value as Role)}
            className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
            aria-label="Preview role permissions"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted dark:text-cream-400">
            {ROLE_HINTS[previewRole]} {roleSummary(previewRole)}
          </p>
          <div className="flex flex-wrap gap-2">
            {PILLARS.map((pillar) => (
              <span
                key={pillar}
                className="rounded-full bg-cream-100 px-2.5 py-1 text-[11px] font-medium text-ink dark:bg-hairline-dark dark:text-cream-200"
              >
                {PILLAR_LABELS[pillar]}: {pillarAccessLabel(previewRole, pillar)}
              </span>
            ))}
            <span className="rounded-full bg-cream-100 px-2.5 py-1 text-[11px] font-medium text-ink dark:bg-hairline-dark dark:text-cream-200">
              Billing:{" "}
              {permissions[previewRole].billing === "*"
                ? "Full"
                : permissions[previewRole].billing === "r"
                  ? "View"
                  : "—"}
            </span>
            <span className="rounded-full bg-cream-100 px-2.5 py-1 text-[11px] font-medium text-ink dark:bg-hairline-dark dark:text-cream-200">
              Team:{" "}
              {permissions[previewRole].team === "*"
                ? "Manage"
                : permissions[previewRole].team === "r"
                  ? "View"
                  : "—"}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-center gap-3 border-b border-cream-200 p-4 dark:border-hairline-dark">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <History className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Activity
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              {auditTotal === 0
                ? "No activity yet"
                : auditTotal > audit.length
                  ? `Showing ${audit.length} of ${auditTotal}`
                  : `${auditTotal} event${auditTotal === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        {audit.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted dark:text-cream-400">
            Invites, role changes, and removals appear here.
          </p>
        ) : (
          <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <p className="text-sm text-ink dark:text-cream-100">
                  {auditActionLabel(entry.action)}
                </p>
                <p className="shrink-0 text-[11px] text-ink-muted dark:text-cream-400">
                  {fmtRelative(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {atSeatLimit && canEdit && showBillingLink ? (
        <p className="text-center text-xs text-ink-muted dark:text-cream-400">
          Seat limit reached.{" "}
          <a href="/settings/subscription" className="font-semibold text-brand-700 dark:text-brand-200">
            Upgrade your plan
          </a>{" "}
          to invite more people.
        </p>
      ) : null}

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-dialog-title"
            className="w-full max-w-md rounded-2xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="invite-dialog-title"
                  className="text-lg font-bold text-ink dark:text-cream-100"
                >
                  Invite team member
                </h3>
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  They&apos;ll get an email to set a password and join (valid 7
                  days).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-5 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-ink dark:text-cream-100">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
                  placeholder="staff@example.com"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-ink dark:text-cream-100">
                  Display name (optional)
                </span>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
                  placeholder="Aina"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-ink dark:text-cream-100">
                  Role
                </span>
                <select
                  value={inviteRole}
                  onChange={(e) => {
                    const r = e.target.value as InviteableRole;
                    setInviteRole(r);
                    setPreviewRole(r);
                  }}
                  className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark"
                >
                  {INVITEABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {ROLE_HINTS[inviteRole]}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg border border-cream-300 px-4 py-2 text-sm font-semibold dark:border-hairline-dark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : null}
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
