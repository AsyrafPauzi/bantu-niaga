"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Link2, Loader2, Unlink } from "lucide-react";
import { apiErrorMessage } from "@/lib/api/client-error";
import {
  filterAvailableTeamMembers,
  suggestTeamMemberByEmail,
} from "@/lib/hr/link-login";
import { hrClasses } from "@/lib/hr/theme";
import { ROLE_LABELS } from "@/lib/settings/team-shared";
import type { Role } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export type TeamLoginOption = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
};

interface HrEmployeeTeamLoginCardProps {
  employeeId: string;
  employeeEmail: string | null;
  linkedUserId: string | null;
  teamMembers: TeamLoginOption[];
  /** user_ids already linked to other employees in this business */
  takenUserIds: string[];
}

export function HrEmployeeTeamLoginCard({
  employeeId,
  employeeEmail,
  linkedUserId,
  teamMembers,
  takenUserIds,
}: HrEmployeeTeamLoginCardProps) {
  const router = useRouter();
  const taken = useMemo(() => new Set(takenUserIds), [takenUserIds]);
  const available = useMemo(
    () =>
      filterAvailableTeamMembers(
        teamMembers,
        taken,
        linkedUserId,
      ) as TeamLoginOption[],
    [teamMembers, taken, linkedUserId],
  );
  const suggested = useMemo(
    () => suggestTeamMemberByEmail(employeeEmail, available, taken),
    [employeeEmail, available, taken],
  );

  const [selectedId, setSelectedId] = useState(
    () => linkedUserId ?? suggested ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const linked = teamMembers.find((m) => m.id === linkedUserId) ?? null;

  async function save(userId: string | null) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/hr/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          apiErrorMessage(
            json,
            json?.message ?? "Could not update team login link.",
          ),
        );
        return;
      }
      setMessage(
        userId
          ? "Linked. They can use /hr/me after signing in."
          : "Unlinked. Staff portal access is removed for this login.",
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-5 sm:p-6 dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-200">
          <KeyRound className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={hrClasses.sectionTitle}>Team login</h2>
          <p className={cn("mt-1", hrClasses.sectionHint)}>
            Link a Settings → Team account so this person can open{" "}
            <span className="font-medium text-ink dark:text-cream-200">
              /hr/me
            </span>{" "}
            for leave and self-service.
          </p>
        </div>
      </div>

      {linked ? (
        <div className="mt-4 rounded-xl border border-teal-200/80 bg-teal-50/60 px-4 py-3 dark:border-teal-900 dark:bg-teal-950/30">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            Linked to {linked.display_name?.trim() || linked.email || "member"}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {linked.email ?? "No email"} · {ROLE_LABELS[linked.role]}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void save(null)}
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60",
              hrClasses.btnSecondary,
            )}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlink className="h-3.5 w-3.5" />
            )}
            Unlink
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {available.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cream-300 px-4 py-6 text-center text-sm text-ink-muted dark:border-hairline-dark dark:text-cream-400">
              No team logins available. Invite them in Settings → Team first.
            </p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-ink dark:text-cream-100">
                  Team member
                </span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="block w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink shadow-card focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
                >
                  <option value="">Select a login…</option>
                  {available.map((m) => {
                    const label =
                      m.display_name?.trim() ||
                      m.email ||
                      m.id.slice(0, 8);
                    const emailHint = m.email ? ` · ${m.email}` : "";
                    const match =
                      suggested === m.id ? " (email match)" : "";
                    return (
                      <option key={m.id} value={m.id}>
                        {label}
                        {emailHint}
                        {m.role ? ` · ${ROLE_LABELS[m.role]}` : ""}
                        {match}
                      </option>
                    );
                  })}
                </select>
              </label>
              {suggested && selectedId === suggested ? (
                <p className="text-xs text-[#0F766E] dark:text-teal-300">
                  Suggested from matching employee email.
                </p>
              ) : null}
              <button
                type="button"
                disabled={pending || !selectedId}
                onClick={() => void save(selectedId || null)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                  hrClasses.btnPrimary,
                )}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Link team login
              </button>
            </>
          )}
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-[#0F766E] dark:text-teal-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
