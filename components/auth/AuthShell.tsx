import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

interface AuthShellProps {
  brandHeading: string;
  brandSubheading: string;
  children: React.ReactNode;
}

/**
 * Shared two-column shell for /sign-in, /sign-up, /forgot-password,
 * /reset-password. Matches the design in pencil-new.pen — left brand
 * panel + right form panel.
 */
export function AuthShell({
  brandHeading,
  brandSubheading,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-dvh bg-cream-100 text-ink dark:bg-surface-dark dark:text-cream-100">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-500 px-14 py-12 text-white lg:flex">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-card"
          >
            <Image
              src="/icon.png"
              alt="Bantu Niaga"
              width={36}
              height={36}
              priority
              className="h-9 w-9 shrink-0"
            />
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-brand-700">
                Bantu <span className="text-accent-500">Niaga</span>
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
                SME Operating System
              </span>
            </span>
          </Link>

          <div className="max-w-md space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-200">
              AI Business Operating System
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
                  Pilar bersepadu
                </dd>
              </div>
              <div>
                <dt className="text-3xl font-bold text-white">24/7</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  AI penasihat
                </dd>
              </div>
              <div>
                <dt className="text-3xl font-bold text-white">100%</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-brand-200">
                  Lokal Malaysia
                </dd>
              </div>
            </dl>
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-brand-100">
            <ShieldCheck className="h-4 w-4 text-accent-300" strokeWidth={2} />
            PDPA &amp; Bank Negara aligned · Supabase Singapore region
          </p>
        </aside>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md space-y-8">
            <div className="flex items-center justify-center gap-3 lg:hidden">
              <Image
                src="/icon.png"
                alt="Bantu Niaga"
                width={48}
                height={48}
                priority
                className="h-12 w-12"
              />
              <span className="text-xl font-bold tracking-tight">
                <span className="text-brand-700 dark:text-brand-200">Bantu</span>{" "}
                <span className="text-accent-500">Niaga</span>
              </span>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
