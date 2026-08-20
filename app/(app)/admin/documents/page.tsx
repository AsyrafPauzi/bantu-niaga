import { redirect } from "next/navigation";
import { FileText, StickyNote } from "lucide-react";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { AdminDocumentsClient } from "@/components/admin/AdminDocumentsClient";
import { AdminSubpageShell } from "@/components/admin/AdminSubpageShell";
import { loadAdminInternalNotes } from "@/lib/admin/notes-load";
import { loadNoteLinkOptions } from "@/lib/admin/notes-link-options";
import { loadAdminDocumentTemplates } from "@/lib/admin/templates";
import { loadBusiness } from "@/lib/settings/business";
import { pillarClasses } from "@/lib/pillars/theme";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Templates & notes · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const canManageNotes = user.role === "owner" || user.role === "manager";

  const [templates, business, profile, initialNotes, linkOptions] =
    await Promise.all([
      loadAdminDocumentTemplates(supabase, user.businessId),
      loadBusiness(user.businessId),
      supabase
        .from("users")
        .select("display_name, email")
        .eq("id", user.id)
        .maybeSingle(),
      canManageNotes
        ? loadAdminInternalNotes(supabase, user.businessId)
        : Promise.resolve([]),
      canManageNotes
        ? loadNoteLinkOptions(supabase, user.businessId)
        : Promise.resolve([]),
    ]);

  const currentUserName =
    profile.data?.display_name?.trim() || profile.data?.email || "You";
  const adminTheme = pillarClasses.admin;
  const pinnedCount = initialNotes.filter((n) => n.is_pinned).length;

  return (
    <AdminSubpageShell
      headline="Templates & notes"
      subcopy="Copy-ready layouts and a private team scratchpad."
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:max-w-md sm:gap-3">
          <ModuleHeroStat
            label="Templates"
            value={templates.length}
            hint="System layouts"
            icon={<FileText />}
            iconClassName={adminTheme.eyebrow}
          />
          {canManageNotes ? (
            <ModuleHeroStat
              label="Notes"
              value={initialNotes.length}
              hint={
                pinnedCount > 0
                  ? `${pinnedCount} pinned`
                  : "Owner & manager only"
              }
              icon={<StickyNote />}
              iconClassName={adminTheme.eyebrow}
            />
          ) : null}
        </div>
      }
    >
      <AdminDocumentsClient
        templates={templates}
        initialNotes={initialNotes}
        canManageNotes={canManageNotes}
        currentUserName={currentUserName}
        templateContext={{
          businessName: business?.name ?? "Your business",
          userName: currentUserName,
        }}
        linkOptions={linkOptions}
      />
    </AdminSubpageShell>
  );
}
