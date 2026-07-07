import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { BrandingForm } from "@/components/settings/BrandingForm";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadBusiness } from "@/lib/settings/business";

export const metadata = { title: "Branding" };
export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/settings");
  const canEdit = user.role === "owner";

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to settings
      </Link>

      <PageHeader
        eyebrow="Settings · Workspace"
        title="Branding"
        description="Make Bantu Niaga look like your business — logo, colours, and the details customers see on receipts, invoices, and emails."
        action={
          canEdit ? null : (
            <Badge tone="warning">View only — owner can edit</Badge>
          )
        }
      />

      <BrandingForm
        canEdit={canEdit}
        initial={{
          name: business.name,
          logo_url: business.logo_url,
          brand_primary_hex: business.brand_primary_hex,
          brand_accent_hex: business.brand_accent_hex,
          registration_no: business.registration_no,
          sst_number: business.sst_number,
          contact_line: business.contact_line,
          receipt_footer: business.receipt_footer,
          email_from_name: business.email_from_name,
          email_reply_to: business.email_reply_to,
        }}
      />
    </div>
  );
}
