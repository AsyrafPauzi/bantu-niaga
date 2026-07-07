"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
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
  seatQuota: number;
  seatUsed: number;
  canEdit: boolean;
  currentUserId: string;
  tierLabel: string;
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

function pillarAccessLabel(role: Role, pillar: (typeof PILLARS)[number]): string {
  const access = permissions[role][pillar];
  if (access === "*") return "Full access";
  if (access === undefined) return "—";
  const keys = Object.keys(access);
  if (keys.length === 0) return "Limited";
  return keys.map((k) => `${k} (${(access as Record<string, string>)[k]})`).join(", ");
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

function memberStatus(member: TeamMemberRow): { label: string; tone: "success" | "warning" | "neutral" } {
  if (member.last_password_change_at) {
    return { label: "Active", tone: "success" };
  }
  return { label: "Pending sign-in", tone: "warning" };
}

export function TeamView({
  members,
  invites,
  audit,
  seatQuota: quota,
  seatUsed,
  canEdit,
  currentUserId,
  tierLabel,
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

  const seatsLabel =
    quota >= 999 ? `${seatUsed} · unlimited` : `${seatUsed} / ${quota}`;

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
        if (json.dev_bypass) {
          setSuccess(
            json.dev_invite_link
              ? `Dev invite link (no email sent): ${json.dev_invite_link}`
              : "Member added (dev mode). Share the invite link from server logs.",
          );
        } else {
          setSuccess(
            `Invite email sent to ${sentTo}. They can set a password from the link (valid 7 days).`,
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
    if (!confirm(`Remove ${name} from your team? They will lose access immediately.`)) {
      return;
    }
    clearMessages();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/team/members/${memberId}`, {
          method: "DELETE",
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

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
            Seats
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-200">
            {seatsLabel}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {tierLabel} plan
            {invites.length > 0
              ? ` · ${invites.length} invite${invites.length === 1 ? "" : "s"} pending`
              : ""}
          </p>
        </div>
        <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
            Active members
          </p>
          <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
            {members.length}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {ROLES.length} roles — from Owner down to front-line Staff
          </p>
        </div>
        <div className="rounded-xl border border-cream-200 bg-white p-5 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-ink-subtle">
            Your access
          </p>
          <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
            {canEdit ? "Owner" : "View only"}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {canEdit
              ? "You can invite, change roles, and revoke access."
              : "Only the owner can manage team members."}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-700 dark:text-brand-200" strokeWidth={2} />
                <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                  Team members
                </h2>
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50 dark:bg-brand-600"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
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
                const display =
                  member.display_name ?? member.email ?? "Unknown";

                return (
                  <li
                    key={member.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
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
                        {member.email ?? "No email"} · Joined {fmtDate(member.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle dark:text-cream-500">
                        {roleSummary(member.role)}
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
                          className="rounded-lg border border-cream-300 p-1.5 text-ink-muted hover:border-status-danger/40 hover:text-status-danger dark:border-hairline-dark"
                          aria-label={`Remove ${display}`}
                        >
                          <UserMinus className="h-4 w-4" />
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
              <div className="flex items-center gap-2 border-b border-cream-200 px-5 py-4 dark:border-hairline-dark">
                <Mail className="h-5 w-5 text-brand-700 dark:text-brand-200" strokeWidth={2} />
                <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                  Pending invites
                </h2>
              </div>
              <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                        {invite.display_name ?? invite.email}
                      </p>
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {invite.email} · {ROLE_LABELS[invite.role]} · Expires{" "}
                        {fmtDate(invite.expires_at)}
                      </p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => cancelInvite(invite.id, invite.email)}
                        className="shrink-0 rounded-lg border border-cream-300 px-2 py-1 text-xs text-ink-muted hover:border-status-danger/40 hover:text-status-danger dark:border-hairline-dark"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex items-center gap-2 border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
              <Shield className="h-4 w-4 text-brand-700 dark:text-brand-200" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Permission preview
              </h2>
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
                {ROLE_HINTS[previewRole]}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {roleSummary(previewRole)}
              </p>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-ink-subtle">
                    <th className="pb-2 font-medium">Module</th>
                    <th className="pb-2 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100 dark:divide-hairline-dark">
                  {PILLARS.map((pillar) => (
                    <tr key={pillar}>
                      <td className="py-1.5 text-ink dark:text-cream-200">
                        {PILLAR_LABELS[pillar]}
                      </td>
                      <td className="py-1.5 text-ink-muted dark:text-cream-400">
                        {pillarAccessLabel(previewRole, pillar)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 text-ink dark:text-cream-200">Billing</td>
                    <td className="py-1.5 text-ink-muted dark:text-cream-400">
                      {permissions[previewRole].billing === "*"
                        ? "Full access"
                        : permissions[previewRole].billing === "r"
                          ? "View only"
                          : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-ink dark:text-cream-200">Team</td>
                    <td className="py-1.5 text-ink-muted dark:text-cream-400">
                      {permissions[previewRole].team === "*"
                        ? "Manage team"
                        : permissions[previewRole].team === "r"
                          ? "View only"
                          : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="border-b border-cream-200 px-4 py-3 dark:border-hairline-dark">
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Activity log
              </h2>
            </div>
            {audit.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-ink-muted dark:text-cream-400">
                No team activity yet.
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-cream-200 overflow-y-auto dark:divide-hairline-dark">
                {audit.map((entry) => (
                  <li key={entry.id} className="px-4 py-2.5">
                    <p className="text-xs font-medium text-ink dark:text-cream-200">
                      {auditActionLabel(entry.action)}
                    </p>
                    <p className="text-[11px] text-ink-muted dark:text-cream-400">
                      {fmtRelative(entry.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-dialog-title"
            className="w-full max-w-md rounded-xl border border-cream-200 bg-white p-6 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="invite-dialog-title"
                  className="text-base font-semibold text-ink dark:text-cream-100"
                >
                  Invite team member
                </h3>
                <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                  They&apos;ll get an email with a link to set their password and join your team.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-5 space-y-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink dark:text-cream-200">
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
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink dark:text-cream-200">
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
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink dark:text-cream-200">
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
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
                {ROLE_HINTS[inviteRole]}
              </p>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {roleSummary(inviteRole)}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg border border-cream-300 px-4 py-2 text-sm dark:border-hairline-dark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {atSeatLimit && canEdit ? (
        <p className="text-center text-xs text-ink-muted dark:text-cream-400">
          Seat limit reached.{" "}
          <a href="/settings/subscription" className="text-brand-700 underline">
            Upgrade your plan
          </a>{" "}
          to invite more people.
        </p>
      ) : null}
    </div>
  );
}
