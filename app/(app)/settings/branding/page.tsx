import { redirect } from "next/navigation";
import { SettingsPageHero } from "@/components/settings/SettingsPageHero";
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

  const summaryParts = [
    business.name,
    business.logo_url ? "logo set" : "no logo",
  ];

  return (
    <>
      <SettingsPageHero
        title="Branding"
        subcopy={summaryParts.join(" · ")}
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
          duitnow_id: business.duitnow_id,
          duitnow_qr_url: business.duitnow_qr_url,
        }}
      />
    </>
  );
}
