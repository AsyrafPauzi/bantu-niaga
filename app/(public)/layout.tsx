import type { ReactNode } from "react";

/**
 * Layout for unauthenticated, secure-hash URLs:
 *   bantuniaga.com/[idcompany]/inv-[hash]
 *   bantuniaga.com/[idcompany]/book-[hash]
 *   bantuniaga.com/[idcompany]/leave-[hash]
 *
 * Mobile-optimized; no app shell chrome (no sidebar, no bottom nav).
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto overscroll-y-contain bg-cream-100 text-ink dark:bg-surface-dark dark:text-cream-100">
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
        {children}
        <footer className="mt-12 pt-6 border-t border-cream-300 text-xs text-ink-subtle text-center">
          Powered by{" "}
          <span className="font-medium text-ink-muted">Bantu Niaga</span>
        </footer>
      </div>
    </div>
  );
}
