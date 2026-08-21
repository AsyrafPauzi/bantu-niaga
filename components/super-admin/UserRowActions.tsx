"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  UserCheck,
  Building2,
  KeyRound,
  ShieldOff,
  ShieldCheck,
  Archive,
} from "lucide-react";

const MENU_WIDTH = 224;
const MENU_ESTIMATE_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;
const MENU_GAP = 6;

function computeMenuCoords(
  trigger: DOMRect,
  menuHeight: number,
): { top: number; left: number } {
  let left = trigger.right - MENU_WIDTH;
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
  );

  const belowTop = trigger.bottom + MENU_GAP;
  const aboveTop = trigger.top - MENU_GAP - menuHeight;
  const fitsBelow =
    belowTop + menuHeight <= window.innerHeight - VIEWPORT_MARGIN;
  const fitsAbove = aboveTop >= VIEWPORT_MARGIN;

  let top: number;
  if (fitsBelow) {
    top = belowTop;
  } else if (fitsAbove) {
    top = aboveTop;
  } else {
    top = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - menuHeight - VIEWPORT_MARGIN,
    );
  }

  return { top, left };
}

export function ImpersonateButton({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (res.ok) {
        window.location.href = "/home";
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        alert(body.message ?? "Impersonation failed");
      }
    });
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title="Impersonate user"
        aria-label="Impersonate user"
        className="grid h-7 w-7 place-items-center rounded-md border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        <UserCheck className="h-3.5 w-3.5" />
      </button>
    );
  }

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
  businessId,
  email,
  isSuspended,
}: {
  userId: string;
  businessId: string;
  email: string | null;
  isSuspended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight =
        menuRef.current?.getBoundingClientRect().height ?? MENU_ESTIMATE_HEIGHT;
      setCoords(computeMenuCoords(rect, menuHeight));
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, isSuspended]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

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
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
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
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        alert(json.message ?? "Delete failed");
      }
    });
  };

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 max-h-[min(280px,calc(100vh-16px))] w-56 overflow-y-auto overscroll-contain rounded-xl border border-cream-300 bg-white p-1.5 shadow-elevated dark:border-hairline-dark dark:bg-panel-dark"
            style={{ top: coords.top, left: coords.left }}
          >
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
              Row actions
            </p>
            <MenuItem
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Open tenant"
              onClick={() => {
                setOpen(false);
                router.push(`/super-admin/businesses/${businessId}`);
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="grid h-7 w-7 place-items-center rounded-lg bg-cream-100 text-ink-muted hover:bg-cream-200"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {menu}
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
      role="menuitem"
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
