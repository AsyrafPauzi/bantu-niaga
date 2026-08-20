"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { NiagaXLogo } from "@/components/brand/NiagaXLogo";
import { TenantI18nProvider } from "@/components/i18n/TenantI18nProvider";
import type { AppLocale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

interface AuthShellProps {
  locale?: AppLocale;
  brandHeading: string;
  brandSubheading: string;
  children: React.ReactNode;
}

function AuthShellInner({
  brandHeading,
  brandSubheading,
  children,
}: Omit<AuthShellProps, "locale">) {
  const t = useTranslations("auth");

  return (
    <main className="h-dvh overflow-y-auto overscroll-y-contain bg-cream-100 text-ink dark:bg-surface-dark dark:text-cream-100">
      <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-500 px-14 py-12 text-white lg:flex">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-card"
          >
            <span className="leading-tight">
              <NiagaXLogo className="block text-base" />
              <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
                {t("brandTagline")}
              </span>
            </span>
          </Link>

          <div className="max-w-md space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-200">
              {t("brandEyebrow")}
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-[44px]">
              {brandHeading}
            </h1>
            <p className="text-base leading-relaxed text-brand-100">
              {brandSubheading}
            </p>
            <dl className="grid grid-cols-3 gap-6 pt-4">
              <div>
                <dt className="text-3xl font-bold text-white">6</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  {t("brandPillars")}
                </dd>
              </div>
              <div>
                <dt className="text-3xl font-bold text-white">24/7</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  {t("brandAi")}
                </dd>
              </div>
              <div>
                <dt className="text-3xl font-bold text-white">100%</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  {t("brandLocal")}
                </dd>
              </div>
            </dl>
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-brand-100">
            <ShieldCheck className="h-4 w-4 text-accent-300" strokeWidth={2} />
            {t("brandFooter")}
          </p>
        </aside>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md space-y-8">
            <div className="flex items-center justify-center lg:hidden">
              <NiagaXLogo className="text-xl" />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Shared two-column shell for /sign-in, /sign-up, /forgot-password,
 * /reset-password. Matches the design in pencil-new.pen — left brand
 * panel + right form panel.
 */
export function AuthShell({
  locale = "en",
  brandHeading,
  brandSubheading,
  children,
}: AuthShellProps) {
  const messages = getMessages(locale);
  return (
    <TenantI18nProvider locale={locale} messages={messages}>
      <AuthShellInner
        brandHeading={brandHeading}
        brandSubheading={brandSubheading}
      >
        {children}
      </AuthShellInner>
    </TenantI18nProvider>
  );
}
