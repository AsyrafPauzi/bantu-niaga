import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { CompleteGoogleSignupForm } from "./complete-form";

export const dynamic = "force-dynamic";

export default async function CompleteGoogleSignupPage() {
  if (isStandaloneDeployment()) {
    redirect("/sign-in");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    redirect("/home");
  }

  return <CompleteGoogleSignupForm email={user.email} />;
}
