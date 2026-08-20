"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ActivationChecklistState } from "@/lib/home/activation-checklist";

export type { ActivationChecklistState };

export function ActivationChecklist({
  state,
}: {
  state: ActivationChecklistState;
}) {
  const t = useTranslations("activation");
  if (state.hasFirstJob) return null;

  const items: Array<{
    done: boolean;
    label: string;
    href: string;
    skip?: boolean;
  }> = [
    {
      done: state.hasCustomer,
      label: t("addCustomer"),
      href: "/marketing/customers/new",
    },
    {
      done: state.hasProduct === true,
      label: t("addProduct"),
      href: "/operations/products",
      skip: !state.showProducts,
    },
    {
      done: state.hasFirstJob,
      label: t("sendInvoiceOrPos"),
      href: "/finance/invoices/new",
    },
    {
      done: state.hasTeamInvite,
      label: t("inviteTeam"),
      href: "/settings/team",
    },
  ];

  return (
    <section className="rounded-2xl border border-accent-200 bg-accent-50/60 p-5 dark:border-accent-700/40 dark:bg-accent-700/10">
      <h2 className="text-base font-semibold text-ink dark:text-cream-100">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
        {t("subtitle")}
      </p>
      <ul className="mt-4 space-y-2">
        {items
          .filter((i) => !i.skip)
          .map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-2 text-sm text-ink hover:underline dark:text-cream-100"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-status-success" />
                ) : (
                  <Circle className="h-4 w-4 text-ink-muted" />
                )}
                <span className={item.done ? "line-through opacity-70" : ""}>
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}
