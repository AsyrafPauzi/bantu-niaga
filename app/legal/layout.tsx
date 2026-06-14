import Link from "next/link";
import type { ReactNode } from "react";

import { Sparkles } from "lucide-react";

/**
 * Layout for the public legal pages (`/legal/privacy`, `/legal/terms`).
 *
 * These are intentionally outside the auth shell so anyone — including
 * search engines, regulators, and prospective customers — can read them
 * without signing in. Search engines *are* allowed to index these.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-50 text-ink dark:bg-canvas-dark dark:text-cream-100">
      <header className="border-b border-cream-200 bg-white/80 backdrop-blur-sm dark:border-hairline-dark dark:bg-panel-dark/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink dark:text-cream-100"
          >
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-brand-500 text-white"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </span>
            Bantu Niaga
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/legal/privacy"
              className="text-ink-muted hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-200"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="text-ink-muted hover:text-brand-700 dark:text-cream-400 dark:hover:text-brand-200"
            >
              Terms
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <article>{children}</article>
      </main>
      <footer className="border-t border-cream-200 bg-cream-50 py-6 text-center text-xs text-ink-subtle dark:border-hairline-dark dark:bg-canvas-dark dark:text-cream-400">
        © {new Date().getFullYear()} Bantu Niaga Sdn. Bhd. · All rights reserved.
      </footer>
    </div>
  );
}
