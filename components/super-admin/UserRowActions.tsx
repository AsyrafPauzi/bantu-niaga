"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  UserCheck,
  Eye,
  Pencil,
  KeyRound,
  ShieldOff,
  ShieldCheck,
  Archive,
} from "lucide-react";

export function ImpersonateButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (res.ok) {
        // Land in the impersonated tenant's Home so the admin sees what
        // the user sees right away.
        window.location.href = "/home";
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        alert(body.message ?? "Impersonation failed");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
    >
      <UserCheck className="h-3 w-3" />
      Impersonate
    </button>
  );
}

export function UserRowMenu({
  userId,
  email,
  isSuspended,
}: {
  userId: string;
  email: string | null;
  isSuspended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const patch = (body: Record<string, unknown>) => {
    startTransition(async () => {
      const res = await fetch(`/api/super-admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        alert(json.message ?? "Action failed");
      }
    });
  };

  const del = () => {
    startTransition(async () => {
      const res = await fetch(`/api/super-admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        alert(json.message ?? "Delete failed");
      }
    });
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-7 w-7 place-items-center rounded-lg bg-cream-100 text-ink-muted hover:bg-cream-200"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30"
            aria-hidden
          />
          <div className="absolute right-0 z-40 mt-1.5 w-56 rounded-xl border border-cream-300 bg-white p-1.5 shadow-elevated">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
              Row actions
            </p>
            <MenuItem
              icon={<Eye className="h-3.5 w-3.5" />}
              label="View profile"
              onClick={() => {
                setOpen(false);
                router.push(`/super-admin/users/${userId}`);
              }}
            />
            <MenuItem
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="Edit details & role"
              onClick={() => {
                setOpen(false);
                router.push(`/super-admin/users/${userId}/edit`);
              }}
            />
            <MenuItem
              icon={<KeyRound className="h-3.5 w-3.5" />}
              label="Send password reset"
              onClick={() =>
                email
                  ? patch({ action: "reset_password" })
                  : alert("This user has no email on file.")
              }
              disabled={!email || pending}
            />
            {isSuspended ? (
              <MenuItem
                icon={<ShieldCheck className="h-3.5 w-3.5 text-status-success" />}
                label="Restore access"
                onClick={() => patch({ action: "restore" })}
                disabled={pending}
              />
            ) : (
              <MenuItem
                icon={<ShieldOff className="h-3.5 w-3.5 text-status-warning" />}
                label="Suspend user"
                tone="warning"
                onClick={() => patch({ action: "suspend" })}
                disabled={pending}
              />
            )}
            <MenuItem
              icon={<Archive className="h-3.5 w-3.5 text-status-danger" />}
              label="Delete user"
              tone="danger"
              onClick={() => {
                if (
                  !confirm(
                    "Permanently delete this user? They will lose access immediately. Tenant data is preserved.",
                  )
                ) {
                  return;
                }
                del();
              }}
              disabled={pending}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = "default",
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "warning" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors disabled:opacity-50 ${
        tone === "danger"
          ? "text-status-danger hover:bg-status-danger/10"
          : tone === "warning"
            ? "text-status-warning hover:bg-status-warning/10"
            : "text-ink hover:bg-cream-100"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
