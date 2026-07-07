import { redirect } from "next/navigation";
import { AddCompanyForm } from "@/components/auth/AddCompanyForm";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";

export const metadata = { title: "Add company" };
export const dynamic = "force-dynamic";

export default async function AddCompanyPage() {
  try {
    await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in?next=/add-company");
    throw e;
  }

  return (
    <div className="py-4">
      <AddCompanyForm />
    </div>
  );
}
