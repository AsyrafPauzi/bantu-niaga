import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";

// Block search engines from indexing the platform-admin app. Combined with
// the noStore Cache-Control header set by next.config.mjs, this keeps the
// surface out of public search results and CDN caches.
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requirePlatformAdmin();

  return (
    <SuperAdminShell
      admin={{ email: admin.email, displayName: admin.displayName }}
    >
      {children}
    </SuperAdminShell>
  );
}
